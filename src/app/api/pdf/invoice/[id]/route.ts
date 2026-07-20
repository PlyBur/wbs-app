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
  const [{ data: inv }, { data: pmts }] = await Promise.all([
    supabase.from("invoices").select("*, clients(*), invoice_line_items(*), workspaces(*)").eq("id", params.id).single(),
    supabase.from("payments").select("*").eq("invoice_id", params.id),
  ])
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ws = inv.workspaces as any
  const cl = inv.clients as any
  const items: any[] = [...((inv.invoice_line_items as any[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const paid = (pmts ?? []).reduce((s: number, p: any) => s + p.amount, 0)
  const due = Math.max(0, inv.total - paid)
  const vatOn = ws?.vat_registered !== false

  // Load payment schedule for term invoices
  let termSchedule: { label: string; pct: number; amount: number; status: string; docNumber?: string }[] = []
  if (inv.term_type && inv.project_id) {
    const { data: project } = await supabase.from("projects").select("*, quotes(*)").eq("id", inv.project_id).single()
    const quote = project?.quotes as any
    if (quote?.terms_enabled) {
      const { data: allTermInvoices } = await supabase
        .from("invoices")
        .select("id, term_type, term_label, total, status, doc_number")
        .eq("project_id", inv.project_id)
        .not("term_type", "is", null)
      const termInvIds = (allTermInvoices ?? []).map((i: any) => i.id)
      const { data: allPayments } = termInvIds.length > 0
        ? await supabase.from("payments").select("invoice_id, amount").in("invoice_id", termInvIds)
        : { data: [] }
      const paymentsByInv: Record<string, number> = {}
      ;(allPayments ?? []).forEach((p: any) => {
        paymentsByInv[p.invoice_id] = (paymentsByInv[p.invoice_id] ?? 0) + p.amount
      })
      const termDefs = [
        { key: "deposit",  label: quote.terms_deposit_label  ?? "Deposit",                    pct: quote.terms_deposit_pct },
        { key: "progress", label: quote.terms_progress_label ?? "Progress payment",            pct: quote.terms_progress_pct },
        { key: "final",    label: quote.terms_final_label    ?? "Final payment on completion", pct: quote.terms_final_pct },
      ].filter((t: any) => t.pct)

      termSchedule = termDefs.map((term: any) => {
        const termInv = (allTermInvoices ?? []).find((i: any) => i.term_type === term.key) as any
        const amount = Math.round(quote.total * term.pct / 100 * 100) / 100
        let status = "Not invoiced"
        if (termInv) {
          const paidAmt = paymentsByInv[termInv.id] ?? 0
          status = paidAmt >= termInv.total ? "Paid" : `Issued (${termInv.doc_number})`
        }
        return { label: term.label, pct: term.pct, amount, status, docNumber: termInv?.doc_number }
      })
    }
  }

  const PDFDocument = (await import("pdfkit")).default
  const doc = new PDFDocument({ margin: 40, size: "A4" })
  const chunks: Buffer[] = []
  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  await new Promise<void>((resolve) => {
    doc.on("end", resolve)

    const W = 515
    const blue = "#2563EB"
    const gray = "#6B7280"
    const lightgray = "#F3F4F6"
    const black = "#111827"

    // ── Header ──────────────────────────────────────────────────────────────
    doc.rect(40, 40, 36, 36).fill(blue)
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(18).text("W", 40, 47, { width: 36, align: "center" })

    doc.fillColor(black).font("Helvetica-Bold").fontSize(12).text(ws?.name ?? "", 85, 42)
    if (vatOn && ws?.vat_number) {
      doc.fillColor(gray).font("Helvetica").fontSize(9).text(`VAT: ${ws.vat_number}`, 85, 57)
    }

    doc.fillColor(blue).font("Helvetica-Bold").fontSize(26).text("INVOICE", 40, 40, { align: "right", width: W })
    doc.fillColor(gray).font("Helvetica").fontSize(9)
    doc.text(inv.doc_number ?? "", 40, 70, { align: "right", width: W })
    doc.text(`Issued: ${fdate(inv.created_at)}`, 40, 82, { align: "right", width: W })
    doc.text(`Due: ${fdate(inv.due_date)}`, 40, 94, { align: "right", width: W })

    // ── Meta box ─────────────────────────────────────────────────────────────
    const metaY = 110
    doc.rect(40, metaY, W, 64).fill(lightgray)

    doc.fillColor(gray).font("Helvetica").fontSize(8).text("BILL TO", 52, metaY + 10)
    doc.fillColor(black).font("Helvetica-Bold").fontSize(10).text(cl?.name ?? "", 52, metaY + 22)
    const clientLines = [cl?.company, cl?.email].filter(Boolean).join("  ·  ")
    if (clientLines) doc.fillColor(gray).font("Helvetica").fontSize(9).text(clientLines, 52, metaY + 35)

    doc.fillColor(gray).font("Helvetica").fontSize(8).text("AMOUNT DUE", 320, metaY + 10)
    doc.fillColor(blue).font("Helvetica-Bold").fontSize(16).text(fzar(due), 320, metaY + 22)
    doc.fillColor(gray).font("Helvetica").fontSize(9).text(`Status: ${inv.status ?? "issued"}`, 320, metaY + 42)

    // ── Line items table ──────────────────────────────────────────────────────
    const tableY = metaY + 78
    const col = { item: 40, qty: 350, up: 400, total: 475 }

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

    addTotRow("Subtotal", fzar(inv.subtotal))
    if (inv.travel_cost > 0) addTotRow("Travel", fzar(inv.travel_cost))
    if (inv.discount_amount > 0) addTotRow("Discount", `-${fzar(inv.discount_amount)}`)
    if (vatOn && inv.vat_rate > 0) addTotRow(`VAT (${inv.vat_rate}%)`, fzar(inv.vat_amount))
    addTotRow(vatOn && inv.vat_rate > 0 ? "Total (incl. VAT)" : "Total", fzar(inv.total), true)

    if (paid > 0) {
      addTotRow("Paid", fzar(paid))
      rowY += 2
      doc.fillColor(blue).font("Helvetica-Bold").fontSize(11)
      doc.text("Amount due", totX, rowY, { width: 120 })
      doc.text(fzar(due), totX, rowY, { width: 155, align: "right" })
      rowY += 16
    }

    // ── Payment schedule ─────────────────────────────────────────────────────
    if (termSchedule.length > 0) {
      rowY += 12
      doc.fillColor(gray).font("Helvetica").fontSize(8).text("PAYMENT SCHEDULE", 40, rowY)
      rowY += 12

      // Header row
      doc.rect(40, rowY, W, 16).fill(lightgray)
      doc.fillColor(gray).font("Helvetica").fontSize(7)
        .text("MILESTONE", 52, rowY + 4)
        .text("%", 310, rowY + 4, { width: 30, align: "right" })
        .text("AMOUNT", 350, rowY + 4, { width: 80, align: "right" })
        .text("STATUS", 440, rowY + 4, { width: 95, align: "right" })
      rowY += 16

      termSchedule.forEach(t => {
        const isCurrent = termSchedule.find(x => x.label === t.label) && inv.term_type
        doc.rect(40, rowY, W, 18).stroke("#E5E7EB")
        doc.fillColor(black).font(isCurrent ? "Helvetica-Bold" : "Helvetica").fontSize(9)
          .text(t.label, 52, rowY + 4, { width: 250 })
        doc.fillColor(gray).font("Helvetica").fontSize(9)
          .text(`${t.pct}%`, 310, rowY + 4, { width: 30, align: "right" })
          .text(fzar(t.amount), 350, rowY + 4, { width: 80, align: "right" })
        const statusColor = t.status === "Paid" ? "#16A34A" : t.status === "Not invoiced" ? gray : "#D97706"
        doc.fillColor(statusColor).font("Helvetica-Bold").fontSize(8)
          .text(t.status, 440, rowY + 5, { width: 95, align: "right" })
        rowY += 18
      })
    }

    // ── Banking details ───────────────────────────────────────────────────────
    if (ws?.bank_name) {
      rowY += 16
      doc.rect(40, rowY, W, 14).fill("#F0FDF4")
      doc.fillColor("#166534").font("Helvetica-Bold").fontSize(8).text("PAYMENT — EFT", 52, rowY + 3)
      rowY += 18

      const bankLines = [
        ws.bank_name ? `Bank: ${ws.bank_name}` : null,
        ws.bank_account_holder ? `Account holder: ${ws.bank_account_holder}` : null,
        ws.bank_account_number ? `Account number: ${ws.bank_account_number}` : null,
        ws.bank_branch_code ? `Branch code: ${ws.bank_branch_code}` : null,
        `Reference: ${inv.doc_number ?? ""}`,
      ].filter(Boolean)

      doc.fillColor(black).font("Helvetica").fontSize(9)
        .text(bankLines.join("   ·   "), 40, rowY, { width: W })
      rowY += 16
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
      "Content-Disposition": `attachment; filename="Invoice-${inv.doc_number ?? "invoice"}.pdf"`,
    },
  })
}
