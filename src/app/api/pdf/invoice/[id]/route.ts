import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { htmlToPdf } from "@/lib/pdf-generator"

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

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${v(inv.doc_number)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:13px;color:#111;padding:40px}
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
.foot{margin-top:40px;padding-top:14px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:11px}</style></head><body>
<div class="hdr">
  <div>${logoHtml}<div class="bn">${v(ws?.name)}</div>${vatOn&&ws?.vat_number?`<div class="bd">VAT: ${ws.vat_number}</div>`:""}</div>
  <div class="dt"><h1>INVOICE</h1><p>${v(inv.doc_number)}</p><p>Issued: ${fdate(inv.created_at)}</p><p>Due: ${fdate(inv.due_date)}</p></div>
</div>
<div class="meta">
  <div class="ms"><h3>Bill to</h3><p class="n">${v(cl?.name)}</p>${cl?.company?`<p>${cl.company}</p>`:""}\
${cl?.email?`<p>${cl.email}</p>`:""}</div>
  <div class="ms"><h3>Amount due</h3><p class="n" style="font-size:20px;color:#2563eb">${fzar(Math.max(0,inv.total-paid))}</p><p style="color:#6b7280">Status: ${v(inv.status) === "issued" ? "Issued" : v(inv.status)}</p></div>
</div>
<table><colgroup><col class="c-desc"><col class="c-qty"><col class="c-up"><col class="c-tot"></colgroup><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>
${items.map((i: any)=>`<tr><td><strong>${v(i.title||i.description)}</strong>${i.title&&i.description?`<div style="color:#6b7280;font-size:12px;margin-top:2px;white-space:pre-wrap">${v(i.description)}</div>`:""}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${fzar(i.unit_price)}</td><td style="text-align:right">${fzar(i.quantity*i.unit_price)}</td></tr>`).join("")}
</tbody></table>
<div class="tots">
  <div class="tr"><span class="tl">Subtotal</span><span>${fzar(inv.subtotal)}</span></div>
  ${inv.travel_cost>0?`<div class="tr"><span class="tl">Travel</span><span>${fzar(inv.travel_cost)}</span></div>`:""}
  ${inv.discount_amount>0?`<div class="tr"><span class="tl">Discount</span><span>-${fzar(inv.discount_amount)}</span></div>`:""}
  ${vatOn?`<div class="tr"><span class="tl">VAT (${inv.vat_rate}%)</span><span>${fzar(inv.vat_amount)}</span></div>`:""}
  <div class="tr tot"><span class="tl">${vatOn?"Total (incl. VAT)":"Total"}</span><span>${fzar(inv.total)}</span></div>
</div>
${bankDetails?`<div class="bank"><h3>Payment — EFT</h3><p>${bankDetails}</p><p style="margin-top:4px"><strong>Reference:</strong> ${v(inv.doc_number)}</p></div>`:""}
<div class="foot">${v(ws?.name)}${ws?.registration_number?" · Reg: "+ws.registration_number:""}${vatOn&&ws?.vat_number?" · VAT: "+ws.vat_number:""}</div>
</body></html>`

  try {
    const pdfBytes = await htmlToPdf(html)
    return new NextResponse(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${v(inv.doc_number) || "invoice"}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error("PDF generation error:", err.message)
    return new NextResponse(html + "<script>window.onload=()=>window.print()</script>", {
      headers: { "Content-Type": "text/html" },
    })
  }
}
