import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib"

const blue  = rgb(0.145, 0.388, 0.922)
const gray  = rgb(0.42,  0.447, 0.502)
const lgray = rgb(0.953, 0.957, 0.965)
const black = rgb(0.067, 0.094, 0.153)
const green = rgb(0.086, 0.502, 0.247)
const amber = rgb(0.851, 0.592, 0.024)

const fzar = (n: number) => {
  const [i, d] = (n || 0).toFixed(2).split(".")
  return "R " + i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + d
}
const fdate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const [{ data: inv }, { data: pmts }] = await Promise.all([
    supabase.from("invoices").select("*, clients(*), invoice_line_items(*), workspaces(*)").eq("id", params.id).single(),
    supabase.from("payments").select("*").eq("invoice_id", params.id),
  ])
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ws  = inv.workspaces as any
  const cl  = inv.clients as any
  const items: any[] = [...((inv.invoice_line_items as any[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const paid = (pmts ?? []).reduce((s: number, p: any) => s + p.amount, 0)
  const due  = Math.max(0, inv.total - paid)
  const vatOn = ws?.vat_registered !== false

  // Load payment schedule for term invoices
  let termSchedule: { label: string; pct: number; amount: number; status: string; isCurrent: boolean }[] = []
  if (inv.term_type && inv.project_id) {
    const { data: project } = await supabase.from("projects").select("*, quotes(*)").eq("id", inv.project_id).single()
    const quote = project?.quotes as any
    if (quote?.terms_enabled) {
      const { data: allTermInvoices } = await supabase
        .from("invoices").select("id, term_type, total, doc_number").eq("project_id", inv.project_id).not("term_type", "is", null)
      const termInvIds = (allTermInvoices ?? []).map((i: any) => i.id)
      const { data: allPayments } = termInvIds.length > 0
        ? await supabase.from("payments").select("invoice_id, amount").in("invoice_id", termInvIds)
        : { data: [] }
      const payByInv: Record<string, number> = {}
      ;(allPayments ?? []).forEach((p: any) => { payByInv[p.invoice_id] = (payByInv[p.invoice_id] ?? 0) + p.amount })
      const termDefs = [
        { key: "deposit",  label: quote.terms_deposit_label  ?? "Deposit",                    pct: quote.terms_deposit_pct },
        { key: "progress", label: quote.terms_progress_label ?? "Progress payment",            pct: quote.terms_progress_pct },
        { key: "final",    label: quote.terms_final_label    ?? "Final payment on completion", pct: quote.terms_final_pct },
      ].filter((t: any) => t.pct)
      termSchedule = termDefs.map((term: any) => {
        const ti = (allTermInvoices ?? []).find((i: any) => i.term_type === term.key) as any
        const amount = Math.round(quote.total * term.pct / 100 * 100) / 100
        let status = "Not invoiced"
        if (ti) { status = (payByInv[ti.id] ?? 0) >= ti.total ? "Paid" : `Issued (${ti.doc_number})` }
        return { label: term.label, pct: term.pct, amount, status, isCurrent: term.key === inv.term_type }
      })
    }
  }

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page = pdfDoc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()
  const L = 40
  const R = width - 40
  const W = R - L

  let y = height - 40

  // ── Header ───────────────────────────────────────────────────────────────
  page.drawRectangle({ x: L, y: y - 36, width: 36, height: 36, color: blue })
  page.drawText("W", { x: L + 10, y: y - 24, size: 18, font: fontBold, color: rgb(1,1,1) })
  page.drawText(ws?.name ?? "", { x: L + 44, y: y - 12, size: 12, font: fontBold, color: black })
  if (vatOn && ws?.vat_number) {
    page.drawText(`VAT: ${ws.vat_number}`, { x: L + 44, y: y - 26, size: 8, font, color: gray })
  }

  const invLabel = "INVOICE"
  page.drawText(invLabel, { x: R - fontBold.widthOfTextAtSize(invLabel, 26), y: y - 12, size: 26, font: fontBold, color: blue })
  page.drawText(inv.doc_number ?? "", { x: R - font.widthOfTextAtSize(inv.doc_number ?? "", 9), y: y - 36, size: 9, font, color: gray })
  const issued = `Issued: ${fdate(inv.created_at)}`
  page.drawText(issued, { x: R - font.widthOfTextAtSize(issued, 9), y: y - 47, size: 9, font, color: gray })
  const dueStr = `Due: ${fdate(inv.due_date)}`
  page.drawText(dueStr, { x: R - font.widthOfTextAtSize(dueStr, 9), y: y - 58, size: 9, font, color: gray })
  y -= 60

  // ── Meta box ──────────────────────────────────────────────────────────────
  y -= 12
  page.drawRectangle({ x: L, y: y - 60, width: W, height: 60, color: lgray })
  page.drawText("BILL TO", { x: L + 12, y: y - 14, size: 7, font, color: gray })
  page.drawText(cl?.name ?? "", { x: L + 12, y: y - 26, size: 10, font: fontBold, color: black })
  const clientSub = [cl?.company, cl?.email].filter(Boolean).join("  ·  ")
  if (clientSub) page.drawText(clientSub, { x: L + 12, y: y - 38, size: 8, font, color: gray })

  page.drawText("AMOUNT DUE", { x: L + 290, y: y - 14, size: 7, font, color: gray })
  page.drawText(fzar(due), { x: L + 290, y: y - 30, size: 16, font: fontBold, color: blue })
  page.drawText(`Status: ${inv.status ?? "issued"}`, { x: L + 290, y: y - 44, size: 8, font, color: gray })
  y -= 74

  // ── Line items ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: L, y: y - 18, width: W, height: 18, color: lgray })
  page.drawText("ITEM",       { x: L + 8,   y: y - 12, size: 7, font, color: gray })
  page.drawText("QTY",        { x: L + 310, y: y - 12, size: 7, font, color: gray })
  page.drawText("UNIT PRICE", { x: L + 360, y: y - 12, size: 7, font, color: gray })
  page.drawText("TOTAL",      { x: L + 450, y: y - 12, size: 7, font, color: gray })
  y -= 18

  items.forEach((item) => {
    const title = item.title || item.description || "Item"
    const desc  = item.title && item.description ? item.description : null
    const rowH  = desc ? 30 : 20
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: lgray })
    page.drawText(title.substring(0, 55), { x: L + 8, y: y - 12, size: 9, font: fontBold, color: black })
    if (desc) page.drawText(desc.substring(0, 65), { x: L + 8, y: y - 23, size: 7, font, color: gray })
    page.drawText(String(item.quantity), { x: L + 310, y: y - 12, size: 9, font, color: black })
    page.drawText(fzar(item.unit_price), { x: L + 355, y: y - 12, size: 9, font, color: black })
    page.drawText(fzar(item.quantity * item.unit_price), { x: L + 445, y: y - 12, size: 9, font: fontBold, color: black })
    y -= rowH
  })

  if (items.length === 0) {
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: lgray })
    page.drawText("No line items", { x: L + 8, y: y - 12, size: 9, font, color: gray })
    y -= 20
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  y -= 10
  const totX = L + 330

  const drawTot = (label: string, value: string, bold = false, colOverride?: any) => {
    const f   = bold ? fontBold : font
    const sz  = bold ? 11 : 9
    const col = colOverride ?? (bold ? black : gray)
    if (bold) {
      page.drawLine({ start: { x: totX, y: y + 4 }, end: { x: R, y: y + 4 }, thickness: 0.8, color: black })
      y -= 4
    }
    page.drawText(label, { x: totX, y, size: sz, font: f, color: col })
    page.drawText(value, { x: R - f.widthOfTextAtSize(value, sz), y, size: sz, font: f, color: col })
    y -= bold ? 16 : 13
  }

  drawTot("Subtotal", fzar(inv.subtotal))
  if (inv.travel_cost > 0) drawTot("Travel", fzar(inv.travel_cost))
  if (inv.discount_amount > 0) drawTot("Discount", `-${fzar(inv.discount_amount)}`)
  if (vatOn && inv.vat_rate > 0) drawTot(`VAT (${inv.vat_rate}%)`, fzar(inv.vat_amount))
  drawTot(vatOn && inv.vat_rate > 0 ? "Total (incl. VAT)" : "Total", fzar(inv.total), true)
  if (paid > 0) {
    drawTot("Paid", fzar(paid))
    page.drawLine({ start: { x: totX, y: y + 4 }, end: { x: R, y: y + 4 }, thickness: 0.8, color: blue })
    y -= 4
    page.drawText("Amount due", { x: totX, y, size: 11, font: fontBold, color: blue })
    page.drawText(fzar(due), { x: R - fontBold.widthOfTextAtSize(fzar(due), 11), y, size: 11, font: fontBold, color: blue })
    y -= 16
  }

  // ── Payment schedule ──────────────────────────────────────────────────────
  if (termSchedule.length > 0) {
    y -= 16
    page.drawText("PAYMENT SCHEDULE", { x: L, y, size: 7, font, color: gray })
    y -= 10

    page.drawRectangle({ x: L, y: y - 16, width: W, height: 16, color: lgray })
    page.drawText("MILESTONE", { x: L + 8, y: y - 11, size: 7, font, color: gray })
    page.drawText("%",         { x: L + 290, y: y - 11, size: 7, font, color: gray })
    page.drawText("AMOUNT",    { x: L + 340, y: y - 11, size: 7, font, color: gray })
    page.drawText("STATUS",    { x: L + 430, y: y - 11, size: 7, font, color: gray })
    y -= 16

    termSchedule.forEach(t => {
      page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: lgray })
      const f = t.isCurrent ? fontBold : font
      page.drawText(t.label, { x: L + 8, y: y - 12, size: 9, font: f, color: black })
      page.drawText(`${t.pct}%`, { x: L + 290, y: y - 12, size: 9, font, color: gray })
      page.drawText(fzar(t.amount), { x: L + 340, y: y - 12, size: 9, font, color: black })
      const sCol = t.status === "Paid" ? green : t.status === "Not invoiced" ? gray : amber
      page.drawText(t.status, { x: L + 430, y: y - 12, size: 8, font: fontBold, color: sCol })
      y -= 18
    })
  }

  // ── Banking details ───────────────────────────────────────────────────────
  if (ws?.bank_name) {
    y -= 16
    page.drawRectangle({ x: L, y: y - 18, width: W, height: 18, color: rgb(0.94, 0.99, 0.96) })
    page.drawText("PAYMENT — EFT", { x: L + 8, y: y - 12, size: 7, font: fontBold, color: green })
    y -= 20

    const bankParts = [
      ws.bank_name ? `Bank: ${ws.bank_name}` : null,
      ws.bank_account_holder ? `Holder: ${ws.bank_account_holder}` : null,
      ws.bank_account_number ? `Acc: ${ws.bank_account_number}` : null,
      ws.bank_branch_code ? `Branch: ${ws.bank_branch_code}` : null,
      `Reference: ${inv.doc_number ?? ""}`,
    ].filter(Boolean).join("   ·   ")

    page.drawText(bankParts, { x: L, y, size: 8, font, color: black, maxWidth: W })
    y -= 14
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footY = 30
  page.drawLine({ start: { x: L, y: footY + 14 }, end: { x: R, y: footY + 14 }, thickness: 0.5, color: lgray })
  const footParts = [ws?.name, ws?.registration_number ? `Reg: ${ws.registration_number}` : null, vatOn && ws?.vat_number ? `VAT: ${ws.vat_number}` : null].filter(Boolean).join("  ·  ")
  page.drawText(footParts, { x: (width - font.widthOfTextAtSize(footParts, 8)) / 2, y: footY, size: 8, font, color: gray })

  const pdfBytes = await pdfDoc.save()
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${inv.doc_number ?? "invoice"}.pdf"`,
    },
  })
}
