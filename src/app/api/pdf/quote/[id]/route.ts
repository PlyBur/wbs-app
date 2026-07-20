import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const fzar = (n: number) => { const [i,d]=(n||0).toFixed(2).split(".");return "R "+i.replace(/\B(?=(\d{3})+(?!\d))/g," ")+","+d }
const fdate = (s: string|null) => s ? new Date(s).toLocaleDateString("en-ZA",{day:"numeric",month:"short",year:"numeric"}) : "—"
const v = (val: any) => val ?? ""

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
  const items: any[] = [...((q.quote_line_items as any[]) ?? [])].sort((a,b)=>a.sort_order-b.sort_order)
  const vatOn = ws?.vat_registered !== false

  const logoHtml = ws?.logo_url
    ? `<img src="${ws.logo_url}" style="height:56px;max-width:180px;object-fit:contain" alt="Logo">`
    : `<div class="logo">W</div>`

  const termsHtml = q.terms_enabled ? `
<div style="margin-top:24px;padding:16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">
  <h3 style="font-size:11px;text-transform:uppercase;color:#16a34a;margin-bottom:10px">Payment schedule</h3>
  ${[
    {label:q.terms_deposit_label??"Deposit",pct:q.terms_deposit_pct},
    {label:q.terms_progress_label??"Progress payment",pct:q.terms_progress_pct},
    {label:q.terms_final_label??"Final payment on completion",pct:q.terms_final_pct},
  ].filter(t=>t.pct).map(t=>`
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #dcfce7">
      <div><span style="font-weight:600">${t.label}</span><span style="color:#6b7280;font-size:12px"> (${t.pct}%)</span></div>
      <span style="font-weight:700">${fzar(q.total*t.pct/100)}</span>
    </div>`).join("")}
</div>` : ""

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quote ${v(q.doc_number)}</title>
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
  <p>Quote ${v(q.doc_number)} — ${v(cl?.name)}</p>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</div>
<div class="page">
<div class="hdr">
  <div>${logoHtml}<div class="bn">${v(ws?.name)}</div>${vatOn&&ws?.vat_number?`<div class="bd">VAT: ${ws.vat_number}</div>`:""}</div>
  <div class="dt"><h1>QUOTE</h1><p>${v(q.doc_number)}</p><p>Date: ${fdate(q.created_at)}</p><p>Expires: ${fdate(q.expires_at)}</p></div>
</div>
<div class="meta">
  <div class="ms"><h3>Prepared for</h3><p class="n">${v(cl?.name)}</p>${cl?.company?`<p>${cl.company}</p>`:""}\
${cl?.email?`<p>${cl.email}</p>`:""}</div>
  <div class="ms"><h3>Quote total</h3><p class="n" style="font-size:20px;color:#2563eb">${fzar(q.total)}</p>${q.project_title?`<p>${q.project_title}</p>`:""}</div>
</div>
<table><colgroup><col class="c-desc"><col class="c-qty"><col class="c-up"><col class="c-tot"></colgroup><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>
${items.map((i: any)=>`<tr><td><strong>${v(i.title||i.description)}</strong>${i.title&&i.description?`<div style="color:#6b7280;font-size:12px;margin-top:2px;white-space:pre-wrap">${v(i.description)}</div>`:""}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${fzar(i.unit_price)}</td><td style="text-align:right">${fzar(i.quantity*i.unit_price)}</td></tr>`).join("")}
</tbody></table>
<div class="tots">
  <div class="tr"><span class="tl">Subtotal</span><span>${fzar(q.subtotal)}</span></div>
  ${q.travel_cost>0?`<div class="tr"><span class="tl">Travel</span><span>${fzar(q.travel_cost)}</span></div>`:""}
  ${q.discount_amount>0?`<div class="tr"><span class="tl">Discount</span><span>-${fzar(q.discount_amount)}</span></div>`:""}
  ${vatOn?`<div class="tr"><span class="tl">VAT (${q.vat_rate}%)</span><span>${fzar(q.vat_amount)}</span></div>`:""}
  <div class="tr tot"><span class="tl">${vatOn?"Total (incl. VAT)":"Total"}</span><span>${fzar(q.total)}</span></div>
</div>
${termsHtml}
${q.notes?`<div style="margin-top:24px"><h3 style="font-size:11px;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Notes</h3><p style="color:#374151;white-space:pre-wrap">${v(q.notes)}</p></div>`:""}
<div class="foot">${v(ws?.name)}${ws?.registration_number?" · Reg: "+ws.registration_number:""}${vatOn&&ws?.vat_number?" · VAT: "+ws.vat_number:""}</div>
</div>
</body></html>`

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  })
}
