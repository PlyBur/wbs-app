import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const fzar = (n: number) => { const [i,d] = (n||0).toFixed(2).split("."); return "R "+i.replace(/\B(?=(\d{3})+(?!\d))/g," ")+","+d }
const fdate = (s: string|null) => s ? new Date(s).toLocaleDateString("en-ZA",{day:"numeric",month:"short",year:"numeric"}) : "—"
const v = (val: any) => val ?? ""

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const [{ data: inv }, { data: pmts }] = await Promise.all([
    supabase.from("invoices").select("*, clients(*), invoice_line_items(*), workspaces(*)").eq("id", params.id).single(),
    supabase.from("payments").select("*").eq("invoice_id", params.id),
  ])
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const ws = inv.workspaces as any
  const cl = inv.clients as any
  const items: any[] = [...((inv.invoice_line_items as any[]) ?? [])].sort((a,b)=>a.sort_order-b.sort_order)
  const paid = (pmts ?? []).reduce((s: number, p: any) => s + p.amount, 0)
  const vatOn = ws?.vat_registered !== false

  // Payment schedule: load if this is a term invoice with a project
  let scheduleHtml = ""
  if (inv.term_type && inv.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("*, quotes(*)")
      .eq("id", inv.project_id)
      .single()
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

      const rows = termDefs.map((term: any) => {
        const termInv = (allTermInvoices ?? []).find((i: any) => i.term_type === term.key) as any
        const amount = Math.round(quote.total * term.pct / 100 * 100) / 100
        let statusLabel = "Not invoiced"
        let statusColor = "#6b7280"
        let statusBg = "#f3f4f6"

        if (termInv) {
          const paidAmt = paymentsByInv[termInv.id] ?? 0
          const fullyPaid = paidAmt >= termInv.total
          if (fullyPaid) {
            statusLabel = "Paid"
            statusColor = "#16a34a"
            statusBg = "#dcfce7"
          } else {
            statusLabel = termInv.doc_number ? `Issued (${termInv.doc_number})` : "Issued"
            statusColor = "#d97706"
            statusBg = "#fef3c7"
          }
        }

        const isCurrent = term.key === inv.term_type
        return `<tr style="${isCurrent ? "background:#eff6ff;" : ""}">
          <td style="padding:8px 12px;font-size:12px;${isCurrent ? "font-weight:600;" : ""}">${term.label}${isCurrent ? " <span style='font-size:10px;color:#2563eb;'>(this invoice)</span>" : ""}</td>
          <td style="padding:8px 12px;text-align:right;font-size:12px;">${term.pct}%</td>
          <td style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;">${fzar(amount)}</td>
          <td style="padding:8px 12px;text-align:right;">
            <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;color:${statusColor};background:${statusBg};">${statusLabel}</span>
          </td>
        </tr>`
      }).join("")

      scheduleHtml = `
<div style="margin-top:28px;">
  <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:10px;">Payment schedule</h3>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:7px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;">Milestone</th>
        <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;">%</th>
        <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;">Amount</th>
        <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`
    }
  }

  const logoHtml = ws?.logo_url
    ? `<img src="${ws.logo_url}" style="height:56px;max-width:180px;object-fit:contain" alt="Logo">`
    : `<div class="logo">W</div>`

  const bankDetails = ws?.bank_name
    ? [
        ws.bank_name ? `<strong>Bank:</strong> ${ws.bank_name}` : "",
        ws.bank_account_number ? `<strong>Acc:</strong> ${ws.bank_account_number}` : "",
        ws.bank_branch_code ? `<strong>Branch:</strong> ${ws.bank_branch_code}` : "",
        ws.bank_account_holder ? `<strong>Holder:</strong> ${ws.bank_account_holder}` : "",
      ].filter(Boolean).join("&nbsp;&nbsp;")
    : ""

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${v(inv.doc_number)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:13px;color:#111;background:#e5e7eb;min-height:100vh}
.page{background:#fff;max-width:800px;margin:0 auto;padding:40px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
.logo{width:40px;height:40px;background:#2563eb;border-radius:8px;color:#fff;font-weight:700;font-size:18px;display:flex;align-items:center;justify-content:center}
.bn{font-weight:700;font-size:15px;margin-top:6px}.bd{color:#6b7280;font-size:12px}
.dt h1{font-size:26px;font-weight:800;color:#2563eb}.dt p{color:#6b7280;font-size:12px;margin-top:3px;text-align:right}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;padding:18px;background:#f9fafb;border-radius:8px}
.ms h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:6px}.ms p{line-height:1.6}.ms .n{font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:20px;table-layout:fixed}
col.c-desc{width:52%}col.c-qty{width:10%}col.c-up{width:19%}col.c-tot{width:19%}
th{background:#f3f4f6;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280}
th:not(:first-child){text-align:right}
td{padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;word-wrap:break-word}
td:not(:first-child){text-align:right;white-space:nowrap}
.tots{margin-left:auto;width:260px}.tr{display:flex;justify-content:space-between;padding:5px 0}.tl{color:#6b7280}
.tr.tot{font-weight:700;font-size:15px;border-top:2px solid #111;margin-top:6px;padding-top:10px}.tr.tot .tl{color:#111}
.bank{margin-top:28px;padding:14px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0}.bank h3{font-size:11px;text-transform:uppercase;color:#16a34a;margin-bottom:6px}
.foot{margin-top:40px;padding-top:14px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:11px}
.print-bar{background:#2563eb;color:#fff;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.print-bar p{font-size:13px;opacity:.85}
.print-btn{background:#fff;color:#2563eb;border:none;border-radius:6px;padding:8px 18px;font-weight:700;font-size:14px;cursor:pointer}
@media print{
  body{background:#fff}
  .print-bar{display:none}
  .page{padding:20px;max-width:none}
}
</style></head><body>
<div class="print-bar">
  <p>Invoice ${v(inv.doc_number)} — ${v(cl?.name)}</p>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</div>
<div class="page">
<div class="hdr">
  <div>${logoHtml}<div class="bn">${v(ws?.name)}</div>${vatOn&&ws?.vat_number?`<div class="bd">VAT: ${ws.vat_number}</div>`:""}</div>
  <div class="dt"><h1>INVOICE</h1><p>${v(inv.doc_number)}</p><p>Issued: ${fdate(inv.created_at)}</p><p>Due: ${fdate(inv.due_date)}</p></div>
</div>
<div class="meta">
  <div class="ms"><h3>Bill to</h3><p class="n">${v(cl?.name)}</p>${cl?.company?`<p>${cl.company}</p>`:""}\
${cl?.email?`<p>${cl.email}</p>`:""}</div>
  <div class="ms"><h3>Amount due</h3><p class="n" style="font-size:20px;color:#2563eb">${fzar(Math.max(0,inv.total-paid))}</p><p style="color:#6b7280">Status: ${v(inv.status)}</p></div>
</div>
<table><colgroup><col class="c-desc"><col class="c-qty"><col class="c-up"><col class="c-tot"></colgroup><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>
${items.map((i: any)=>`<tr><td><strong>${v(i.title||i.description)}</strong>${i.title&&i.description?`<div style="color:#6b7280;font-size:12px;margin-top:2px;white-space:pre-wrap">${v(i.description)}</div>`:""}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${fzar(i.unit_price)}</td><td style="text-align:right">${fzar(i.quantity*i.unit_price)}</td></tr>`).join("")}
</tbody></table>
<div class="tots">
  <div class="tr"><span class="tl">Subtotal</span><span>${fzar(inv.subtotal)}</span></div>
  ${inv.travel_cost>0?`<div class="tr"><span class="tl">Travel</span><span>${fzar(inv.travel_cost)}</span></div>`:""}
  ${inv.discount_amount>0?`<div class="tr"><span class="tl">Discount</span><span>-${fzar(inv.discount_amount)}</span></div>`:""}
  ${vatOn&&inv.vat_rate>0?`<div class="tr"><span class="tl">VAT (${inv.vat_rate}%)</span><span>${fzar(inv.vat_amount)}</span></div>`:""}
  <div class="tr tot"><span class="tl">${vatOn&&inv.vat_rate>0?"Total (incl. VAT)":"Total"}</span><span>${fzar(inv.total)}</span></div>
</div>
${scheduleHtml}
${bankDetails?`<div class="bank"><h3>Payment — EFT</h3><p>${bankDetails}</p><p style="margin-top:4px"><strong>Reference:</strong> ${v(inv.doc_number)}</p></div>`:""}
<div class="foot">${v(ws?.name)}${ws?.registration_number?" · Reg: "+ws.registration_number:""}${vatOn&&ws?.vat_number?" · VAT: "+ws.vat_number:""}</div>
</div>
</body></html>`

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  })
}
