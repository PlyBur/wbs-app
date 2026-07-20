"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatZAR, shortDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/lib/toast"
import { PageSkeleton } from "@/components/ui/skeleton"
import { Mail, Building2, Trash2, X } from "lucide-react"

const statusColour: Record<string, any> = { draft: "muted", issued: "default", sent: "default", paid: "success", overdue: "destructive", cancelled: "muted" }

export default function InvoiceDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [invoice, setInvoice] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [workspace, setWorkspace] = useState<any>(null)
  const [termSchedule, setTermSchedule] = useState<any[]>([])
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "eft", reference: "", notes: "" })
  const [savingPayment, setSavingPayment] = useState(false)

  const today = new Date().toISOString().split("T")[0]

  async function load() {
    const [{ data: inv }, { data: pmts }, ws] = await Promise.all([
      supabase.from("invoices").select("*, clients(*), invoice_line_items(*)").eq("id", id).single(),
      supabase.from("payments").select("*").eq("invoice_id", id).order("paid_at", { ascending: false }),
      fetch("/api/settings").then(r => r.json()),
    ])
    setInvoice(inv); setPayments(pmts ?? []); setWorkspace(ws)

    // Load payment schedule if this is a term invoice
    if (inv?.term_type && inv?.project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("*, quotes(*)")
        .eq("id", inv.project_id)
        .single()
      const quote = project?.quotes as any

      if (quote?.terms_enabled) {
        const { data: allTermInvs } = await supabase
          .from("invoices")
          .select("id, term_type, term_label, total, status, doc_number")
          .eq("project_id", inv.project_id)
          .not("term_type", "is", null)

        const ids = (allTermInvs ?? []).map((i: any) => i.id)
        const { data: allPmts } = ids.length > 0
          ? await supabase.from("payments").select("invoice_id, amount").in("invoice_id", ids)
          : { data: [] }

        const paidMap: Record<string, number> = {}
        ;(allPmts ?? []).forEach((p: any) => { paidMap[p.invoice_id] = (paidMap[p.invoice_id] ?? 0) + p.amount })

        const defs = [
          { key: "deposit",  label: quote.terms_deposit_label  ?? "Deposit",                    pct: quote.terms_deposit_pct },
          { key: "progress", label: quote.terms_progress_label ?? "Progress payment",            pct: quote.terms_progress_pct },
          { key: "final",    label: quote.terms_final_label    ?? "Final payment on completion", pct: quote.terms_final_pct },
        ].filter((t: any) => t.pct)

        setTermSchedule(defs.map((term: any) => {
          const ti = (allTermInvs ?? []).find((i: any) => i.term_type === term.key) as any
          const amount = Math.round(quote.total * term.pct / 100 * 100) / 100
          let status = "not_invoiced"
          let docNumber = null
          if (ti) {
            const paidAmt = paidMap[ti.id] ?? 0
            status = paidAmt >= ti.total ? "paid" : "issued"
            docNumber = ti.doc_number
          }
          return { ...term, amount, status, docNumber, isCurrent: term.key === inv.term_type }
        }))
      }
    }
  }

  useEffect(() => { load() }, [id])

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault()
    setSavingPayment(true)
    const res = await fetch(`/api/invoices/${id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...paymentForm, amount: parseFloat(paymentForm.amount) }),
    })
    if (res.ok) {
      await load()
      setShowPaymentForm(false)
      setPaymentForm({ amount: "", method: "eft", reference: "", notes: "" })
    } else {
      const err = await res.json()
      toast(err.error ?? "Failed to record payment", "error")
    }
    setSavingPayment(false)
  }

  async function deleteInvoice() {
    if (!confirm(`Delete ${invoice.doc_number}? This cannot be undone.`)) return
    await fetch(`/api/invoices/${id}`, { method: "DELETE" })
    router.refresh()
    router.push("/invoices")
  }

  if (!invoice) return <DashboardLayout title="Invoice"><PageSkeleton /></DashboardLayout>

  const client = invoice.clients as any
  const lineItems: any[] = [...((invoice.invoice_line_items as any[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const paid = payments.reduce((s, p) => s + p.amount, 0)
  const due = Math.max(0, invoice.total - paid)
  const isOverdue = invoice.status === "issued" && invoice.due_date && invoice.due_date < today
  const displayStatus = isOverdue ? "overdue" : invoice.status
  const vatOn = workspace?.vat_registered !== false

  const termStatusBadge = (status: string, docNumber: string | null) => {
    if (status === "paid") return <Badge variant="success">Paid</Badge>
    if (status === "issued") return <span className="text-xs text-warning-foreground font-medium">{docNumber ? `Issued · ${docNumber}` : "Issued"}</span>
    return <span className="text-xs text-muted-foreground">Not invoiced</span>
  }

  return (
    <DashboardLayout
      title={invoice.doc_number ?? "Invoice"}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusColour[displayStatus] ?? "muted"}>{displayStatus}</Badge>
          <a href={`/api/pdf/invoice/${id}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">Download PDF</Button>
          </a>
          {due > 0 && (
            <Button size="sm" onClick={() => { setShowPaymentForm(true); setPaymentForm(f => ({ ...f, amount: String(due.toFixed(2)) })) }}>
              Record payment
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={deleteInvoice}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      }
    >
      <div className="max-w-3xl space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-sm">Client</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">{client?.name ?? "No client"}</p>
            {client?.company && <p className="text-muted-foreground flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{client.company}</p>}
            {client?.email && <p className="text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{client.email}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Invoice number</p><p className="font-medium">{invoice.doc_number ?? "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Issued</p><p className="font-medium">{shortDate(invoice.created_at)}</p></div>
              <div><p className="text-muted-foreground text-xs">Due date</p><p className={`font-medium ${isOverdue ? "text-destructive" : ""}`}>{shortDate(invoice.due_date)}</p></div>
              <div><p className="text-muted-foreground text-xs">Status</p><Badge variant={statusColour[displayStatus] ?? "muted"}>{displayStatus}</Badge></div>
              <div><p className="text-muted-foreground text-xs">Total</p><p className="font-semibold text-lg">{formatZAR(invoice.total)}</p></div>
              <div>
                <p className="text-muted-foreground text-xs">Amount due</p>
                <p className={`font-semibold text-lg ${due > 0 ? "text-destructive" : "text-success"}`}>{formatZAR(due)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Line items</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Item</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">Qty</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">Unit price</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lineItems.map((item, i) => (
                  <tr key={item.id ?? i}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{item.title || item.description}</p>
                      {item.title && item.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">{item.description}</p>}
                    </td>
                    <td className="px-5 py-3 text-right">{item.quantity}</td>
                    <td className="px-5 py-3 text-right">{formatZAR(item.unit_price)}</td>
                    <td className="px-5 py-3 text-right font-semibold">{formatZAR(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-border px-5 py-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatZAR(invoice.subtotal)}</span></div>
              {invoice.travel_cost > 0 && <div className="flex justify-between text-muted-foreground"><span>Travel</span><span>{formatZAR(invoice.travel_cost)}</span></div>}
              {invoice.discount_amount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{formatZAR(invoice.discount_amount)}</span></div>}
              {vatOn && invoice.vat_rate > 0 && <div className="flex justify-between text-muted-foreground"><span>VAT ({invoice.vat_rate}%)</span><span>{formatZAR(invoice.vat_amount)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t border-border pt-2"><span>Total</span><span>{formatZAR(invoice.total)}</span></div>
            </div>
          </CardContent>
        </Card>

        {termSchedule.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Payment schedule</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {termSchedule.map((term, i) => (
                  <li key={i} className={`flex items-center justify-between px-5 py-3.5 text-sm ${term.isCurrent ? "bg-primary/5" : ""}`}>
                    <div>
                      <p className={`font-medium ${term.isCurrent ? "text-primary" : ""}`}>
                        {term.label}
                        {term.isCurrent && <span className="ml-2 text-xs font-normal text-primary">(this invoice)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{term.pct}% of total</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-semibold">{formatZAR(term.amount)}</p>
                      {termStatusBadge(term.status, term.docNumber)}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {payments.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Payments received</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {payments.map(p => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">{shortDate(p.paid_at)}</p>
                      <p className="text-xs text-muted-foreground">{p.method?.toUpperCase()}{p.reference ? ` · ${p.reference}` : ""}</p>
                    </div>
                    <span className="font-semibold text-success">{formatZAR(p.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border px-5 py-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Total paid</span>
                <span className="font-semibold text-success">{formatZAR(paid)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {showPaymentForm && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Record payment</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setShowPaymentForm(false)}><X className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={recordPayment} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Amount (ZAR)</label>
                    <Input type="number" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Method</label>
                    <select value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none">
                      <option value="eft">EFT</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Reference</label>
                  <Input value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} placeholder="Bank reference" />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={savingPayment}>{savingPayment ? "Saving…" : "Record payment"}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowPaymentForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
