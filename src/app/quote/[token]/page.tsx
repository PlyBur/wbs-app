import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { formatZAR, shortDate } from "@/lib/utils"
import AcceptQuoteButton from "./AcceptQuoteButton"

export default async function PublicQuotePage({ params }: { params: { token: string } }) {
  const supabase = await createClient()
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, clients(*), quote_line_items(*), workspaces(*)")
    .eq("public_token", params.token)
    .single()

  if (!quote) notFound()

  const ws = quote.workspaces as any
  const cl = quote.clients as any
  const items: any[] = [...((quote.quote_line_items as any[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const vatOn = ws?.vat_registered !== false

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            {ws?.logo_url
              ? <img src={ws.logo_url} alt={ws.name} className="h-12 max-w-[160px] object-contain mb-3" />
              : <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg mb-3">W</div>
            }
            <p className="font-bold text-lg">{ws?.name}</p>
            {ws?.vat_number && vatOn && <p className="text-sm text-gray-500">VAT: {ws.vat_number}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold text-blue-600">QUOTE</p>
            <p className="text-gray-500 text-sm mt-1">{quote.doc_number}</p>
            <p className="text-gray-500 text-sm">Expires: {shortDate(quote.expires_at)}</p>
          </div>
        </div>

        {/* Client */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Prepared for</p>
          <p className="font-semibold">{cl?.name}</p>
          {cl?.company && <p className="text-gray-500 text-sm">{cl.company}</p>}
          {cl?.email && <p className="text-gray-500 text-sm">{cl.email}</p>}
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">Item</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400">Qty</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400">Unit price</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{item.title || item.description}</p>
                    {item.title && item.description && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{item.description}</p>}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatZAR(item.unit_price)}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatZAR(item.quantity * item.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-5 py-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatZAR(quote.subtotal)}</span></div>
            {quote.travel_cost > 0 && <div className="flex justify-between text-gray-500"><span>Travel</span><span>{formatZAR(quote.travel_cost)}</span></div>}
            {quote.discount_amount > 0 && <div className="flex justify-between text-gray-500"><span>Discount</span><span>-{formatZAR(quote.discount_amount)}</span></div>}
            {vatOn && <div className="flex justify-between text-gray-500"><span>VAT ({quote.vat_rate}%)</span><span>{formatZAR(quote.vat_amount)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
              <span>{vatOn ? "Total (incl. VAT)" : "Total"}</span>
              <span className="text-blue-600">{formatZAR(quote.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment terms */}
        {quote.terms_enabled && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-green-800 mb-3">Payment schedule</p>
            <div className="space-y-2">
              {[
                { label: quote.terms_deposit_label ?? "Deposit", pct: quote.terms_deposit_pct },
                { label: quote.terms_progress_label ?? "Progress payment", pct: quote.terms_progress_pct },
                { label: quote.terms_final_label ?? "Final payment on completion", pct: quote.terms_final_pct },
              ].filter(t => t.pct).map((term, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-green-700">{term.label} ({term.pct}%)</span>
                  <span className="font-semibold text-green-800">{formatZAR(quote.total * term.pct / 100)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {quote.notes && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Notes</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* Accept button */}
        {(quote.status === "sent" || quote.status === "draft") && (
          <AcceptQuoteButton quoteId={quote.id} token={params.token} />
        )}
        {quote.status === "accepted" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <p className="text-green-700 font-semibold">✓ Quote accepted</p>
            <p className="text-green-600 text-sm mt-1">Thank you! We will be in touch shortly.</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          {ws?.name}{ws?.registration_number ? ` · Reg: ${ws.registration_number}` : ""}{vatOn && ws?.vat_number ? ` · VAT: ${ws.vat_number}` : ""}
        </p>
      </div>
    </div>
  )
}
