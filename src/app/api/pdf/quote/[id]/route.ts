import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib"

const blue = rgb(0.145, 0.388, 0.922)   // #2563EB
const gray = rgb(0.42, 0.447, 0.502)    // #6B7280
const lgray = rgb(0.953, 0.957, 0.965)  // #F3F4F6
const black = rgb(0.067, 0.094, 0.153)  // #111827
const green = rgb(0.086, 0.502, 0.247)  // #166534

const fzar = (n: number) => {
  const [i, d] = (n || 0).toFixed(2).split(".")
  return "R " + i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + d
}
const fdate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: q } = await supabase
    .from("quotes")
    .select("*, clients(*), quote_line_items(*), workspaces(*)")
    .eq("id", params.id)
    .single()
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ws = q.workspaces as any
  const cl = q.clients as any
  const items: any[] = [...((q.quote_line_items as any[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const vatOn = ws?.vat_registered !== false

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page = pdfDoc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()
  const L = 40        // left margin
  const R = width - 40 // right edge
  const W = R - L     // usable width

  let y = height - 40

  // ── Logo box ─────────────────────────────────────────────────────────────
  page.drawRectangle({ x: L, y: y - 36, width: 36, height: 36, color: blue })
  page.drawText("W", { x: L + 10, y: y - 24, size: 18, font: fontBold, color: rgb(1,1,1) })

  // Business name
  page.drawText(ws?.name ?? "", { x: L + 44, y: y - 12, size: 12, font: fontBold, color: black })
  if (vatOn && ws?.vat_number) {
    page.drawText(`VAT: ${ws.vat_number}`, { x: L + 44, y: y - 26, size: 8, font, color: gray })
  }

  // QUOTE (right aligned)
  const quoteLabelW = fontBold.widthOfTextAtSize("QUOTE", 26)
  page.drawText("QUOTE", { x: R - quoteLabelW, y: y - 12, size: 26, font: fontBold, color: blue })
  const docNumW = font.widthOfTextAtSize(q.doc_number ?? "", 9)
  page.drawText(q.doc_number ?? "", { x: R - docNumW, y: y - 36, size: 9, font, color: gray })
  const dateStr = `Date: ${fdate(q.created_at)}`
  page.drawText(dateStr, { x: R - font.widthOfTextAtSize(dateStr, 9), y: y - 47, size: 9, font, color: gray })
  const expStr = `Expires: ${fdate(q.expires_at)}`
  page.drawText(expStr, { x: R - font.widthOfTextAtSize(expStr, 9), y: y - 58, size: 9, font, color: gray })

  y -= 60

  // ── Meta box ─────────────────────────────────────────────────────────────
  y -= 12
  page.drawRectangle({ x: L, y: y - 60, width: W, height: 60, color: lgray })
  page.drawText("PREPARED FOR", { x: L + 12, y: y - 14, size: 7, font, color: gray })
  page.drawText(cl?.name ?? "", { x: L + 12, y: y - 26, size: 10, font: fontBold, color: black })
  const clientSub = [cl?.company, cl?.email].filter(Boolean).join("  ·  ")
  if (clientSub) page.drawText(clientSub, { x: L + 12, y: y - 38, size: 8, font, color: gray })

  page.drawText("QUOTE TOTAL", { x: L + 290, y: y - 14, size: 7, font, color: gray })
  page.drawText(fzar(q.total), { x: L + 290, y: y - 30, size: 16, font: fontBold, color: blue })
  if (q.project_title) page.drawText(q.project_title, { x: L + 290, y: y - 44, size: 8, font, color: gray })

  y -= 74

  // ── Line items table ──────────────────────────────────────────────────────
  // Header
  page.drawRectangle({ x: L, y: y - 18, width: W, height: 18, color: lgray })
  page.drawText("ITEM",       { x: L + 8,   y: y - 12, size: 7, font, color: gray })
  page.drawText("QTY",        { x: L + 310, y: y - 12, size: 7, font, color: gray })
  page.drawText("UNIT PRICE", { x: L + 360, y: y - 12, size: 7, font, color: gray })
  page.drawText("TOTAL",      { x: L + 450, y: y - 12, size: 7, font, color: gray })
  y -= 18

  items.forEach((item) => {
    const title = item.title || item.description || "Item"
    const desc = item.title && item.description ? item.description : null
    const rowH = desc ? 30 : 20

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

  const drawTot = (label: string, value: string, bold = false) => {
    const f = bold ? fontBold : font
    const sz = bold ? 11 : 9
    const col = bold ? black : gray
    if (bold) {
      page.drawLine({ start: { x: totX, y: y + 4 }, end: { x: R, y: y + 4 }, thickness: 0.8, color: black })
      y -= 4
    }
    page.drawText(label, { x: totX, y, size: sz, font: f, color: col })
    const vW = f.widthOfTextAtSize(value, sz)
    page.drawText(value, { x: R - vW, y, size: sz, font: f, color: col })
    y -= bold ? 16 : 13
  }

  drawTot("Subtotal", fzar(q.subtotal))
  if (q.travel_cost > 0) drawTot("Travel", fzar(q.travel_cost))
  if (q.discount_amount > 0) drawTot("Discount", `-${fzar(q.discount_amount)}`)
  if (vatOn) drawTot(`VAT (${q.vat_rate}%)`, fzar(q.vat_amount))
  drawTot(vatOn ? "Total (incl. VAT)" : "Total", fzar(q.total), true)

  // ── Payment schedule ──────────────────────────────────────────────────────
  if (q.terms_enabled) {
    y -= 16
    page.drawText("PAYMENT SCHEDULE", { x: L, y, size: 7, font, color: gray })
    y -= 10
    const termDefs = [
      { label: q.terms_deposit_label  ?? "Deposit",                    pct: q.terms_deposit_pct },
      { label: q.terms_progress_label ?? "Progress payment",           pct: q.terms_progress_pct },
      { label: q.terms_final_label    ?? "Final payment on completion", pct: q.terms_final_pct },
    ].filter(t => t.pct)
    termDefs.forEach(t => {
      page.drawRectangle({ x: L, y: y - 16, width: W, height: 16, color: rgb(0.94, 0.99, 0.96) })
      page.drawText(`${t.label} (${t.pct}%)`, { x: L + 8, y: y - 11, size: 9, font: fontBold, color: green })
      const amt = fzar(q.total * t.pct / 100)
      page.drawText(amt, { x: R - fontBold.widthOfTextAtSize(amt, 9), y: y - 11, size: 9, font: fontBold, color: green })
      y -= 16
    })
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (q.notes) {
    y -= 14
    page.drawText("NOTES", { x: L, y, size: 7, font, color: gray })
    y -= 12
    page.drawText(q.notes.substring(0, 200), { x: L, y, size: 9, font, color: black, maxWidth: W, lineHeight: 14 })
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footY = 30
  page.drawLine({ start: { x: L, y: footY + 14 }, end: { x: R, y: footY + 14 }, thickness: 0.5, color: lgray })
  const footParts = [ws?.name, ws?.registration_number ? `Reg: ${ws.registration_number}` : null, vatOn && ws?.vat_number ? `VAT: ${ws.vat_number}` : null].filter(Boolean).join("  ·  ")
  const footW = font.widthOfTextAtSize(footParts, 8)
  page.drawText(footParts, { x: (width - footW) / 2, y: footY, size: 8, font, color: gray })

  const pdfBytes = await pdfDoc.save()
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Quote-${q.doc_number ?? "quote"}.pdf"`,
    },
  })
}
