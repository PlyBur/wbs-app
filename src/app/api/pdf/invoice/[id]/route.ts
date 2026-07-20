import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib"

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  blue:    rgb(0.145, 0.388, 0.922),
  black:   rgb(0.067, 0.094, 0.153),
  gray:    rgb(0.42,  0.447, 0.502),
  lgray:   rgb(0.953, 0.957, 0.965),
  mgray:   rgb(0.882, 0.894, 0.914),
  white:   rgb(1, 1, 1),
  green:   rgb(0.086, 0.502, 0.247),
  greenBg: rgb(0.941, 0.992, 0.961),
  amber:   rgb(0.851, 0.592, 0.024),
  red:     rgb(0.8,   0.1,   0.1),
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fzar = (n: number) => {
  const [i, d] = (n || 0).toFixed(2).split(".")
  return "R " + i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + d
}
const fdate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"

async function fetchLogoImage(pdfDoc: PDFDocument, logoUrl: string) {
  try {
    const res = await fetch(logoUrl)
    if (!res.ok) return null
    const bytes = await res.arrayBuffer()
    const ct  = res.headers.get("content-type") ?? ""
    const url = logoUrl.toLowerCase()
    if (ct.includes("png") || url.includes(".png")) return await pdfDoc.embedPng(bytes)
    if (ct.includes("jpeg") || ct.includes("jpg") || url.includes(".jpg") || url.includes(".jpeg")) return await pdfDoc.embedJpg(bytes)
    try { return await pdfDoc.embedPng(bytes) } catch { return await pdfDoc.embedJpg(bytes) }
  } catch { return null }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const [{ data: inv }, { data: pmts }] = await Promise.all([
    supabase.from("invoices").select("*, clients(*), invoice_line_items(*), workspaces(*)").eq("id", params.id).single(),
    supabase.from("payments").select("*").eq("invoice_id", params.id),
  ])
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ws    = inv.workspaces as any
  const cl    = inv.clients   as any
  const items: any[] = [...((inv.invoice_line_items as any[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const paid  = (pmts ?? []).reduce((s: number, p: any) => s + p.amount, 0)
  const due   = Math.max(0, inv.total - paid)
  const vatOn = ws?.vat_registered !== false

  // ── Payment schedule for term invoices ────────────────────────────────────
  let termSchedule: { label: string; pct: number; amount: number; status: string; isCurrent: boolean }[] = []
  if (inv.term_type && inv.project_id) {
    const { data: project } = await supabase.from("projects").select("*, quotes(*)").eq("id", inv.project_id).single()
    const quote = project?.quotes as any
    if (quote?.terms_enabled) {
      const { data: allTermInv } = await supabase
        .from("invoices").select("id, term_type, total, doc_number").eq("project_id", inv.project_id).not("term_type", "is", null)
      const ids = (allTermInv ?? []).map((i: any) => i.id)
      const { data: allPay } = ids.length > 0
        ? await supabase.from("payments").select("invoice_id, amount").in("invoice_id", ids)
        : { data: [] }
      const payByInv: Record<string, number> = {}
      ;(allPay ?? []).forEach((p: any) => { payByInv[p.invoice_id] = (payByInv[p.invoice_id] ?? 0) + p.amount })
      const defs = [
        { key: "deposit",  label: quote.terms_deposit_label  ?? "Deposit",                    pct: quote.terms_deposit_pct },
        { key: "progress", label: quote.terms_progress_label ?? "Progress payment",            pct: quote.terms_progress_pct },
        { key: "final",    label: quote.terms_final_label    ?? "Final payment on completion", pct: quote.terms_final_pct },
      ].filter((t: any) => t.pct)
      termSchedule = defs.map((t: any) => {
        const ti = (allTermInv ?? []).find((i: any) => i.term_type === t.key) as any
        const amount = Math.round(quote.total * t.pct / 100 * 100) / 100
        let status = "Not invoiced"
        if (ti) status = (payByInv[ti.id] ?? 0) >= ti.total ? "Paid" : `Issued (${ti.doc_number})`
        return { label: t.label, pct: t.pct, amount, status, isCurrent: t.key === inv.term_type }
      })
    }
  }

  // ── Build PDF ────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create()
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const logoImg = ws?.logo_url ? await fetchLogoImage(pdfDoc, ws.logo_url) : null

  const page = pdfDoc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()
  const L = 44
  const R = width - 44
  const W = R - L

  let y = height

  // ── Blue accent stripe ─────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 5, width, height: 5, color: C.blue })
  y = height - 5

  // ── Header ────────────────────────────────────────────────────────────────
  y -= 44

  if (logoImg) {
    const dims = logoImg.scaleToFit(110, 44)
    page.drawImage(logoImg, { x: L, y, width: dims.width, height: dims.height })
  } else {
    page.drawRectangle({ x: L, y, width: 44, height: 44, color: C.blue, borderRadius: 6 })
    const wW = fontB.widthOfTextAtSize("W", 22)
    page.drawText("W", { x: L + (44 - wW) / 2, y: y + 11, size: 22, font: fontB, color: C.white })
  }

  page.drawText(ws?.name ?? "", { x: L, y: y - 16, size: 11, font: fontB, color: C.black })
  if (vatOn && ws?.vat_number) {
    page.drawText(`VAT No: ${ws.vat_number}`, { x: L, y: y - 28, size: 8, font, color: C.gray })
  }

  const label = "INVOICE"
  const labelW = fontB.widthOfTextAtSize(label, 30)
  page.drawText(label, { x: R - labelW, y: y + 8, size: 30, font: fontB, color: C.blue })

  const details = [inv.doc_number ?? "", `Issued: ${fdate(inv.created_at)}`, `Due: ${fdate(inv.due_date)}`]
  let detY = y - 10
  for (const d of details) {
    const dW = font.widthOfTextAtSize(d, 9)
    page.drawText(d, { x: R - dW, y: detY, size: 9, font, color: C.gray })
    detY -= 13
  }

  y -= 50

  // ── Divider ───────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.75, color: C.mgray })
  y -= 16

  // ── Meta box ──────────────────────────────────────────────────────────────
  const metaH = 72
  page.drawRectangle({ x: L, y: y - metaH, width: W, height: metaH, color: C.lgray, borderRadius: 6 })

  page.drawText("BILL TO", { x: L + 14, y: y - 14, size: 7, font, color: C.gray })
  page.drawText(cl?.name ?? "", { x: L + 14, y: y - 28, size: 11, font: fontB, color: C.black })
  const clSub = [cl?.company, cl?.email, cl?.phone].filter(Boolean)
  clSub.forEach((line, i) => {
    page.drawText(line, { x: L + 14, y: y - 41 - i * 12, size: 8.5, font, color: C.gray })
  })

  page.drawLine({ start: { x: L + W / 2, y: y - 10 }, end: { x: L + W / 2, y: y - metaH + 10 }, thickness: 0.5, color: C.mgray })

  const rX = L + W / 2 + 14
  page.drawText("AMOUNT DUE", { x: rX, y: y - 14, size: 7, font, color: C.gray })
  page.drawText(fzar(due), { x: rX, y: y - 32, size: 18, font: fontB, color: C.blue })
  const statusLabel = inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : "Issued"
  page.drawText(`Status: ${statusLabel}`, { x: rX, y: y - 48, size: 9, font, color: C.gray })

  y -= metaH + 20

  // ── Line items table ──────────────────────────────────────────────────────
  const col = { desc: L, qty: L + 330, up: L + 375, tot: L + 455, rEdge: R }

  const thH = 22
  page.drawRectangle({ x: L, y: y - thH, width: W, height: thH, color: C.blue, borderRadius: 4 })
  page.drawText("ITEM",       { x: col.desc + 8, y: y - 15, size: 8, font: fontB, color: C.white })
  page.drawText("QTY",        { x: col.qty,       y: y - 15, size: 8, font: fontB, color: C.white })
  page.drawText("UNIT PRICE", { x: col.up,        y: y - 15, size: 8, font: fontB, color: C.white })
  page.drawText("TOTAL",      { x: col.tot,       y: y - 15, size: 8, font: fontB, color: C.white })
  y -= thH

  items.forEach((item, idx) => {
    const title = (item.title || item.description || "Item").substring(0, 58)
    const desc  = item.title && item.description ? item.description.substring(0, 70) : null
    const rowH  = desc ? 34 : 22

    if (idx % 2 === 1) page.drawRectangle({ x: L, y: y - rowH, width: W, height: rowH, color: rgb(0.98, 0.984, 1) })
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.4, color: C.mgray })

    page.drawText(title, { x: col.desc + 8, y: y - 14, size: 9.5, font: fontB, color: C.black })
    if (desc) page.drawText(desc, { x: col.desc + 8, y: y - 26, size: 8, font, color: C.gray })
    page.drawText(String(item.quantity), { x: col.qty, y: y - 14, size: 9.5, font, color: C.black })
    page.drawText(fzar(item.unit_price), { x: col.up, y: y - 14, size: 9.5, font, color: C.black })
    const totStr = fzar(item.quantity * item.unit_price)
    page.drawText(totStr, { x: col.rEdge - fontB.widthOfTextAtSize(totStr, 9.5), y: y - 14, size: 9.5, font: fontB, color: C.black })
    y -= rowH
  })

  if (items.length === 0) {
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.4, color: C.mgray })
    page.drawText("No line items", { x: col.desc + 8, y: y - 14, size: 9, font, color: C.gray })
    y -= 22
  }

  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.75, color: C.mgray })
  y -= 16

  // ── Totals ────────────────────────────────────────────────────────────────
  const tX = L + 295

  const drawTotRow = (label: string, value: string, bold = false, colOverride?: typeof C.blue) => {
    const f   = bold ? fontB : font
    const sz  = bold ? 11.5 : 9.5
    const col = colOverride ?? (bold ? C.black : C.gray)
    page.drawText(label, { x: tX, y, size: sz, font: f, color: col })
    const vW = f.widthOfTextAtSize(value, sz)
    page.drawText(value, { x: R - vW, y, size: sz, font: f, color: col })
    y -= bold ? 8 : 4
    if (bold) {
      page.drawLine({ start: { x: tX, y }, end: { x: R, y }, thickness: 0.75, color: C.black })
      y -= 8
    } else {
      y -= 13
    }
  }

  drawTotRow("Subtotal", fzar(inv.subtotal))
  if (inv.travel_cost > 0) drawTotRow("Travel", fzar(inv.travel_cost))
  if (inv.discount_amount > 0) drawTotRow("Discount", `-${fzar(inv.discount_amount)}`)
  if (vatOn && inv.vat_rate > 0) drawTotRow(`VAT (${inv.vat_rate}%)`, fzar(inv.vat_amount))
  drawTotRow(vatOn && inv.vat_rate > 0 ? "Total (incl. VAT)" : "Total", fzar(inv.total), true)

  if (paid > 0) {
    drawTotRow("Paid", `-${fzar(paid)}`)
    y -= 2
    page.drawLine({ start: { x: tX, y: y + 4 }, end: { x: R, y: y + 4 }, thickness: 0.75, color: C.blue })
    y -= 4
    page.drawText("Amount due", { x: tX, y, size: 12, font: fontB, color: C.blue })
    const dueStr = fzar(due)
    page.drawText(dueStr, { x: R - fontB.widthOfTextAtSize(dueStr, 12), y, size: 12, font: fontB, color: C.blue })
    y -= 20
  }

  y -= 8

  // ── Payment schedule ──────────────────────────────────────────────────────
  if (termSchedule.length > 0) {
    page.drawText("PAYMENT SCHEDULE", { x: L, y, size: 7.5, font: fontB, color: C.gray })
    y -= 14

    // Header
    const shH = 18
    page.drawRectangle({ x: L, y: y - shH, width: W, height: shH, color: C.lgray })
    page.drawText("MILESTONE", { x: L + 8,   y: y - 12, size: 7.5, font: fontB, color: C.gray })
    page.drawText("%",         { x: L + 290, y: y - 12, size: 7.5, font: fontB, color: C.gray })
    page.drawText("AMOUNT",    { x: L + 335, y: y - 12, size: 7.5, font: fontB, color: C.gray })
    page.drawText("STATUS",    { x: L + 425, y: y - 12, size: 7.5, font: fontB, color: C.gray })
    y -= shH

    termSchedule.forEach(t => {
      const rowH = 20
      if (t.isCurrent) page.drawRectangle({ x: L, y: y - rowH, width: W, height: rowH, color: rgb(0.937, 0.953, 0.996) })
      page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.4, color: C.mgray })

      const f = t.isCurrent ? fontB : font
      page.drawText(t.label + (t.isCurrent ? " ◀" : ""), { x: L + 8, y: y - 13, size: 9, font: f, color: C.black })
      page.drawText(`${t.pct}%`, { x: L + 290, y: y - 13, size: 9, font, color: C.gray })
      page.drawText(fzar(t.amount), { x: L + 335, y: y - 13, size: 9, font, color: C.black })

      const sCol = t.status === "Paid" ? C.green : t.status === "Not invoiced" ? C.gray : C.amber
      page.drawText(t.status, { x: L + 425, y: y - 13, size: 8.5, font: fontB, color: sCol })
      y -= rowH
    })
    y -= 10
  }

  // ── Banking details ───────────────────────────────────────────────────────
  if (ws?.bank_name) {
    y -= 6
    const bankH = 38
    page.drawRectangle({ x: L, y: y - bankH, width: W, height: bankH, color: C.greenBg, borderRadius: 6 })
    page.drawText("PAYMENT — EFT", { x: L + 12, y: y - 14, size: 8, font: fontB, color: C.green })

    const bankLine = [
      ws.bank_name           ? `Bank: ${ws.bank_name}` : null,
      ws.bank_account_holder ? `Holder: ${ws.bank_account_holder}` : null,
      ws.bank_account_number ? `Acc: ${ws.bank_account_number}` : null,
      ws.bank_branch_code    ? `Branch: ${ws.bank_branch_code}` : null,
    ].filter(Boolean).join("   ·   ")

    page.drawText(bankLine, { x: L + 12, y: y - 26, size: 8.5, font, color: C.black, maxWidth: W - 24 })
    page.drawText(`Reference: ${inv.doc_number ?? ""}`, { x: L + 12, y: y - 36, size: 8.5, font: fontB, color: C.black })
    y -= bankH + 8
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footY = 36
  page.drawLine({ start: { x: L, y: footY + 16 }, end: { x: R, y: footY + 16 }, thickness: 0.5, color: C.mgray })
  const parts = [ws?.name, ws?.registration_number ? `Reg: ${ws.registration_number}` : null, vatOn && ws?.vat_number ? `VAT: ${ws.vat_number}` : null, ws?.email ?? null].filter(Boolean).join("   ·   ")
  const partsW = font.widthOfTextAtSize(parts, 8)
  page.drawText(parts, { x: (width - partsW) / 2, y: footY, size: 8, font, color: C.gray })

  // ── Output ────────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save()
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${inv.doc_number ?? "invoice"}.pdf"`,
    },
  })
}
