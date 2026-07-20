import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib"

// ── Colours ──────────────────────────────────────────────────────────────────
const C = {
  blue:    rgb(0.145, 0.388, 0.922),  // #2563EB
  blueDk:  rgb(0.118, 0.306, 0.737),  // slightly darker blue for stripe
  black:   rgb(0.067, 0.094, 0.153),  // #111827
  gray:    rgb(0.42,  0.447, 0.502),  // #6B7280
  lgray:   rgb(0.953, 0.957, 0.965),  // #F3F4F6
  mgray:   rgb(0.882, 0.894, 0.914),  // #E1E4E9 - border lines
  white:   rgb(1, 1, 1),
  green:   rgb(0.086, 0.502, 0.247),  // #166534
  greenBg: rgb(0.941, 0.992, 0.961),  // #F0FDF4
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
    const ct = res.headers.get("content-type") ?? ""
    const url = logoUrl.toLowerCase()
    if (ct.includes("png") || url.includes(".png")) return await pdfDoc.embedPng(bytes)
    if (ct.includes("jpeg") || ct.includes("jpg") || url.includes(".jpg") || url.includes(".jpeg")) return await pdfDoc.embedJpg(bytes)
    // Try PNG first, then JPEG
    try { return await pdfDoc.embedPng(bytes) } catch { return await pdfDoc.embedJpg(bytes) }
  } catch { return null }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: q } = await supabase
    .from("quotes")
    .select("*, clients(*), quote_line_items(*), workspaces(*)")
    .eq("id", params.id)
    .single()
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ws    = q.workspaces as any
  const cl    = q.clients   as any
  const items: any[] = [...((q.quote_line_items as any[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const vatOn = ws?.vat_registered !== false

  // ── Build PDF ────────────────────────────────────────────────────────────
  const pdfDoc  = await PDFDocument.create()
  const font    = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontB   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Try to load logo
  const logoImg = ws?.logo_url ? await fetchLogoImage(pdfDoc, ws.logo_url) : null

  const page        = pdfDoc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()
  const L  = 44          // left margin
  const R  = width - 44  // right edge
  const W  = R - L       // usable width (507)

  let y = height  // we'll draw top-down

  // ── Blue accent stripe ────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 5, width, height: 5, color: C.blue })
  y = height - 5

  // ── Header ────────────────────────────────────────────────────────────────
  y -= 44

  // Logo or placeholder
  if (logoImg) {
    const dims = logoImg.scaleToFit(110, 44)
    page.drawImage(logoImg, { x: L, y, width: dims.width, height: dims.height })
  } else {
    page.drawRectangle({ x: L, y, width: 44, height: 44, color: C.blue })
    const wW = fontB.widthOfTextAtSize("W", 22)
    page.drawText("W", { x: L + (44 - wW) / 2, y: y + 11, size: 22, font: fontB, color: C.white })
  }

  // Business name + VAT under logo
  page.drawText(ws?.name ?? "", { x: L, y: y - 16, size: 11, font: fontB, color: C.black })
  if (vatOn && ws?.vat_number) {
    page.drawText(`VAT No: ${ws.vat_number}`, { x: L, y: y - 28, size: 8, font, color: C.gray })
  }

  // QUOTE label (right)
  const ql = "QUOTE"
  const qlW = fontB.widthOfTextAtSize(ql, 30)
  page.drawText(ql, { x: R - qlW, y: y + 8, size: 30, font: fontB, color: C.blue })

  // Doc details (right, below QUOTE)
  const details = [
    q.doc_number ?? "",
    `Date: ${fdate(q.created_at)}`,
    `Expires: ${fdate(q.expires_at)}`,
  ]
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

  // ── Meta: bill-to / quote-total ───────────────────────────────────────────
  const metaH = 72
  page.drawRectangle({ x: L, y: y - metaH, width: W, height: metaH, color: C.lgray })

  // Left: Prepared for
  page.drawText("PREPARED FOR", { x: L + 14, y: y - 14, size: 7, font, color: C.gray })
  page.drawText(cl?.name ?? "", { x: L + 14, y: y - 28, size: 11, font: fontB, color: C.black })
  const clSub = [cl?.company, cl?.email, cl?.phone].filter(Boolean)
  clSub.forEach((line, i) => {
    page.drawText(line, { x: L + 14, y: y - 41 - i * 12, size: 8.5, font, color: C.gray })
  })

  // Vertical divider
  page.drawLine({ start: { x: L + W / 2, y: y - 10 }, end: { x: L + W / 2, y: y - metaH + 10 }, thickness: 0.5, color: C.mgray })

  // Right: Quote total
  const totX = L + W / 2 + 14
  page.drawText("QUOTE TOTAL", { x: totX, y: y - 14, size: 7, font, color: C.gray })
  const totalStr = fzar(q.total)
  page.drawText(totalStr, { x: totX, y: y - 32, size: 18, font: fontB, color: C.blue })
  if (q.project_title) {
    page.drawText(q.project_title, { x: totX, y: y - 48, size: 9, font, color: C.gray })
  }

  y -= metaH + 20

  // ── Line items table ──────────────────────────────────────────────────────
  // Column positions
  const col = {
    desc:  L,
    qty:   L + 330,
    up:    L + 375,
    tot:   L + 455,
    rEdge: R,
  }

  // Table header
  const thH = 22
  page.drawRectangle({ x: L, y: y - thH, width: W, height: thH, color: C.blue })
  page.drawText("ITEM",       { x: col.desc + 8, y: y - 15, size: 8, font: fontB, color: C.white })
  page.drawText("QTY",        { x: col.qty,       y: y - 15, size: 8, font: fontB, color: C.white })
  page.drawText("UNIT PRICE", { x: col.up,        y: y - 15, size: 8, font: fontB, color: C.white })
  page.drawText("TOTAL",      { x: col.tot,       y: y - 15, size: 8, font: fontB, color: C.white })
  y -= thH

  // Rows
  items.forEach((item, idx) => {
    const title = (item.title || item.description || "Item").substring(0, 58)
    const desc  = item.title && item.description ? item.description.substring(0, 70) : null
    const rowH  = desc ? 34 : 22

    if (idx % 2 === 1) {
      page.drawRectangle({ x: L, y: y - rowH, width: W, height: rowH, color: rgb(0.98, 0.984, 1) })
    }
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.4, color: C.mgray })

    page.drawText(title, { x: col.desc + 8, y: y - 14, size: 9.5, font: fontB, color: C.black })
    if (desc) page.drawText(desc, { x: col.desc + 8, y: y - 26, size: 8, font, color: C.gray })

    const qtyStr = String(item.quantity)
    page.drawText(qtyStr, { x: col.qty, y: y - 14, size: 9.5, font, color: C.black })

    const upStr = fzar(item.unit_price)
    page.drawText(upStr, { x: col.up, y: y - 14, size: 9.5, font, color: C.black })

    const totStr = fzar(item.quantity * item.unit_price)
    const totStrW = fontB.widthOfTextAtSize(totStr, 9.5)
    page.drawText(totStr, { x: col.rEdge - totStrW, y: y - 14, size: 9.5, font: fontB, color: C.black })

    y -= rowH
  })

  if (items.length === 0) {
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.4, color: C.mgray })
    page.drawText("No line items", { x: col.desc + 8, y: y - 14, size: 9, font, color: C.gray })
    y -= 22
  }

  // Bottom border
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.75, color: C.mgray })
  y -= 16

  // ── Totals ────────────────────────────────────────────────────────────────
  const tX = L + 295  // totals start x
  const tW = R - tX   // totals width

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

  drawTotRow("Subtotal", fzar(q.subtotal))
  if (q.travel_cost > 0) drawTotRow("Travel", fzar(q.travel_cost))
  if (q.discount_amount > 0) drawTotRow("Discount", `-${fzar(q.discount_amount)}`)
  if (vatOn) drawTotRow(`VAT (${q.vat_rate}%)`, fzar(q.vat_amount))
  drawTotRow(vatOn ? "Total (incl. VAT)" : "Total", fzar(q.total), true)

  y -= 8

  // ── Payment schedule ──────────────────────────────────────────────────────
  if (q.terms_enabled) {
    page.drawText("PAYMENT SCHEDULE", { x: L, y, size: 7.5, font: fontB, color: C.gray })
    y -= 14

    const termDefs = [
      { label: q.terms_deposit_label  ?? "Deposit",                    pct: q.terms_deposit_pct },
      { label: q.terms_progress_label ?? "Progress payment",           pct: q.terms_progress_pct },
      { label: q.terms_final_label    ?? "Final payment on completion", pct: q.terms_final_pct },
    ].filter(t => t.pct)

    termDefs.forEach((t, i) => {
      const bg = i % 2 === 0 ? C.greenBg : rgb(0.96, 0.998, 0.975)
      page.drawRectangle({ x: L, y: y - 20, width: W, height: 20, color: bg })
      if (i === 0) page.drawRectangle({ x: L, y: y - 20, width: W, height: 20, color: bg })
      page.drawText(`${t.label}`, { x: L + 10, y: y - 13, size: 9.5, font: fontB, color: C.green })
      page.drawText(`${t.pct}%`,  { x: L + 10, y: y - 13, size: 9.5, font, color: C.gray })
      const amt = fzar(q.total * t.pct / 100)
      const amtW = fontB.widthOfTextAtSize(amt, 9.5)
      // fix: label on left, pct in middle, amount right
      const lblW = fontB.widthOfTextAtSize(`${t.label}`, 9.5)
      page.drawText(`  (${t.pct}%)`, { x: L + 10 + lblW, y: y - 13, size: 9, font, color: C.gray })
      page.drawText(amt, { x: R - amtW, y: y - 13, size: 9.5, font: fontB, color: C.green })
      y -= 20
    })
    y -= 8
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (q.notes) {
    page.drawText("NOTES", { x: L, y, size: 7.5, font: fontB, color: C.gray })
    y -= 14
    page.drawText(q.notes.substring(0, 300), { x: L, y, size: 9, font, color: C.black, maxWidth: W, lineHeight: 14 })
    y -= 28
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
      "Content-Disposition": `attachment; filename="Quote-${q.doc_number ?? "quote"}.pdf"`,
    },
  })
}
