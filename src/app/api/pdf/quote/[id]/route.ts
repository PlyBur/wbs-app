import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

  // Dynamic import so pdfkit is only loaded server-side
  const PDFDocument = (await import("pdfkit")).default

  const doc = new PDFDocument({ margin: 40, size: "A4" })
  const chunks: Buffer[] = []
  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  await new Promise<void>((resolve) => {
    doc.on("end", resolve)

    const W = 515 // usable width
    const blue = "#2563EB"
    const gray = "#6B7280"
    const lightgray = "#F3F4F6"
    const black = "#111827"

    // ── Header ──────────────────────────────────────────────────────────────
    // Logo placeholder (blue square)
    doc.rect(40, 40, 36, 36).fill(blue)
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(18).text("W", 40, 47, { width: 36, align: "center" })

    // Business name
    doc.fillColor(black).font("Helvetica-Bold").fontSize(12).text(ws?.name ?? "", 85, 42)
    if (vatOn && ws?.vat_number) {
      doc.fillColor(gray).font("Helvetica").fontSize(9).text(`VAT: ${ws.vat_number}`, 85, 57)
    }

    // QUOTE label (right)
    doc.fillColor(blue).font("Helvetica-Bold").fontSize(26).text("QUOTE", 40, 40, { align: "right", width: W })
    doc.fillColor(gray).font("Helvetica").fontSize(9)
    doc.text(q.doc_number ?? "", 40, 70, { align: "right", width: W })
    doc.text(`Date: ${fdate(q.created_at)}`, 40, 82, { align: "right", width: W })
    doc.text(`Expires: ${fdate(q.expires_at)}`, 40, 94, { align: "right", width: W })

    doc.moveDown(3)

    // ── Meta box ─────────────────────────────────────────────────────────────
    const metaY = 110
    doc.rect(40, metaY, W, 64).fill(lightgray)

    // Prepared for
    doc.fillColor(gray).font("Helvetica").fontSize(8).text("PREPARED FOR", 52, metaY + 10)
    doc.fillColor(black).font("Helvetica-Bold").fontSize(10).text(cl?.name ?? "", 52, metaY + 22)
    const clientLines = [cl?.company, cl?.email].filter(Boolean).join("  ·  ")
    if (clientLines) doc.fillColor(gray).font("Helvetica").fontSize(9).text(clientLines, 52, metaY + 35)

    // Quote total
    doc.fillColor(gray).font("Helvetica").fontSize(8).text("QUOTE TOTAL", 320, metaY + 10)
    doc.fillColor(blue).font("Helvetica-Bold").fontSize(16).text(fzar(q.total), 320, metaY + 22)
    if (q.project_title) {
      doc.fillColor(gray).font("Helvetica").fontSize(9).text(q.project_title, 320, metaY + 42)
    }

    // ── Line items table ──────────────────────────────────────────────────────
    const tableY = metaY + 78
    const col = { item: 40, qty: 350, up: 400, total: 475 }

    // Table header
    doc.rect(40, tableY, W, 20).fill(lightgray)
    doc.fillColor(gray).font("Helvetica").fontSize(8)
    doc.text("ITEM", col.item + 8, tableY + 6)
    doc.text("QTY", col.qty, tableY + 6, { width: 45, align: "right" })
    doc.text("UNIT PRICE", col.up, tableY + 6, { width: 65, align: "right" })
    doc.text("TOTAL", col.total, tableY + 6, { width: 40, align: "right" })

    let rowY = tableY + 20
    items.forEach((item) => {
      const title = item.title || item.description || "Item"
      const desc = item.title && item.description ? item.description : null
      const rowH = desc ? 32 : 20

      doc.rect(40, rowY, W, rowH).stroke("#E5E7EB")
      doc.fillColor(black).font("Helvetica-Bold").fontSize(9).text(title, col.item + 8, rowY + 5, { width: 290 })
      if (desc) {
        doc.fillColor(gray).font("Helvetica").fontSize(8).text(desc, col.item + 8, rowY + 17, { width: 290 })
      }
      doc.fillColor(black).font("Helvetica").fontSize(9)
      doc.text(String(item.quantity), col.qty, rowY + 5, { width: 45, align: "right" })
      doc.text(fzar(item.unit_price), col.up, rowY + 5, { width: 65, align: "right" })
      doc.text(fzar(item.quantity * item.unit_price), col.total, rowY + 5, { width: 40, align: "right" })
      rowY += rowH
    })

    if (items.length === 0) {
      doc.fillColor(gray).font("Helvetica").fontSize(9).text("No line items", col.item + 8, rowY + 5)
      rowY += 20
    }

    // ── Totals ────────────────────────────────────────────────────────────────
    rowY += 8
    const totX = 350

    const addTotRow = (label: string, value: string, bold = false) => {
      doc.fillColor(bold ? black : gray)
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 11 : 9)
      doc.text(label, totX, rowY, { width: 120 })
      doc.text(value, totX, rowY, { width: 120 + 35, align: "right" })
      if (bold) {
        doc.moveTo(totX, rowY - 4).lineTo(totX + 155, rowY - 4).strokeColor("#111827").lineWidth(1).stroke()
      }
      rowY += bold ? 16 : 13
    }

    addTotRow("Subtotal", fzar(q.subtotal))
    if (q.travel_cost > 0) addTotRow("Travel", fzar(q.travel_cost))
    if (q.discount_amount > 0) addTotRow("Discount", `-${fzar(q.discount_amount)}`)
    if (vatOn) addTotRow(`VAT (${q.vat_rate}%)`, fzar(q.vat_amount))
    addTotRow(vatOn ? "Total (incl. VAT)" : "Total", fzar(q.total), true)

    // ── Payment schedule (if terms enabled) ───────────────────────────────────
    if (q.terms_enabled) {
      rowY += 12
      doc.fillColor(gray).font("Helvetica").fontSize(8).text("PAYMENT SCHEDULE", 40, rowY)
      rowY += 12

      const termDefs = [
        { label: q.terms_deposit_label ?? "Deposit",                  pct: q.terms_deposit_pct },
        { label: q.terms_progress_label ?? "Progress payment",        pct: q.terms_progress_pct },
        { label: q.terms_final_label ?? "Final payment on completion", pct: q.terms_final_pct },
      ].filter(t => t.pct)

      termDefs.forEach(t => {
        doc.rect(40, rowY, W, 18).fill("#F0FDF4")
        doc.fillColor("#166534").font("Helvetica-Bold").fontSize(9)
          .text(`${t.label} (${t.pct}%)`, 52, rowY + 4, { width: 300 })
        doc.text(fzar(q.total * t.pct / 100), 52, rowY + 4, { width: W - 24, align: "right" })
        rowY += 18
      })
    }

    // ── Notes ─────────────────────────────────────────────────────────────────
    if (q.notes) {
      rowY += 12
      doc.fillColor(gray).font("Helvetica").fontSize(8).text("NOTES", 40, rowY)
      rowY += 10
      doc.fillColor(black).font("Helvetica").fontSize(9).text(q.notes, 40, rowY, { width: W })
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = 760
    doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor("#E5E7EB").lineWidth(0.5).stroke()
    const footParts = [ws?.name, ws?.registration_number ? `Reg: ${ws.registration_number}` : null, vatOn && ws?.vat_number ? `VAT: ${ws.vat_number}` : null].filter(Boolean).join("  ·  ")
    doc.fillColor(gray).font("Helvetica").fontSize(8).text(footParts, 40, footerY + 6, { align: "center", width: W })

    doc.end()
  })

  const pdfBuffer = Buffer.concat(chunks)
  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Quote-${q.doc_number ?? "quote"}.pdf"`,
    },
  })
}
