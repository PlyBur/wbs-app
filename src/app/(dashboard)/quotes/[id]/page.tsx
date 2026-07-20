"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatZAR, shortDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Mail, Phone, Building2, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"

const statusColour: Record<string, any> = {
  draft: "muted", sent: "default", accepted: "success", declined: "destructive", expired: "warning"
}

export default function QuoteDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const [quote, setQuote] = useState<any>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [converting, setConverting] = useState(false)

  useEffect(() => {
    supabase.from("quotes")
      .select("*, clients(*), quote_line_items(*), projects(id, title, status)")
      .eq("id", id).single().then(({ data }) => setQuote(data))
    fetch("/api/settings").then(r => r.json()).then(setWorkspace)
  }, [id])

  async function markSent() {
    await supabase.from("quotes").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id)
    setQuote((q: any) => ({ ...q, status: "sent", sent_at: new Date().toISOString() }))
  }

  async function acceptQuote() {
    if (!confirm("Mark this quote as accepted?")) return
    await supabase.from("quotes").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", id)
    setQuote((q: any) => ({ ...q, status: "accepted", accepted_at: new Date().toISOString() }))
  }

  async function convertToProject() {
    setConverting(true)
    const res = await fetch(`/api/quotes/${id}/convert`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({})
    })
    const project = await res.json()
    if (project.id) router.push(`/projects/${project.id}`)
    else { alert(project.error ?? "Conversion failed"); setConverting(false) }
  }

  async function deleteQuote() {
    if (!confirm(`Delete ${quote.doc_number}? This cannot be undone.`)) return
    await fetch(`/api/quotes/${id}`, { method: "DELETE" })
    router.refresh()
    router.push("/quotes")
  }

  if (!quote) {
    return <DashboardLayout title="Quote"><p className="text-sm text-muted-foreground">Loading…</p></DashboardLayout>
  }

  const client = quote.clients as any
  const lineItems: any[] = quote.quote_line_items ?? []
  const linkedProject = Array.isArray(quote.projects) ? quote.projects[0] : quote.projects
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/quote/${quote.public_token}` : ""
  const vatOn = workspace?.vat_registered !== false

  return (
    <DashboardLayout
      title={quote.doc_number ?? "Quote"}
      actions={
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <Badge variant={statusColour[quote.status] ?? "muted"}>{quote.status}</Badge>
          <Link href={`/quotes/${id}/edit`}>
            <Button size="sm" variant="outline"><Pencil className="w-3.5 h-3.5" />Edit</Button>
          </Link>
          <a href={`/api/pdf/quote/${id}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">Download PDF</Button>
          </a>
          {quote.status === "draft" && (
            <Button size="sm" onClick={markSent}>Mark as sent</Button>
          )}
          {(quote.status === "draft" || quote.status === "sent") && (
            <Button
              size="sm" variant="outline"
              className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              onClick={acceptQuote}
            >
              Accept quote
            </Button>
          )}
          {quote.status === "sent" && (
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); alert("Client link copied!") }}>
              Copy client link
            </Button>
          )}
          {quote.status === "accepted" && linkedProject && (
            <Link href={`/projects/${linkedProject.id}`}>
              <Button size="sm" variant="outline">View project</Button>
            </Link>
          )}
          {quote.status === "accepted" && !linkedProject && (
            <Button size="sm" onClick={convertToProject} disabled={converting}>
              {converting ? "Converting…" : "Convert to project"}
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={deleteQuote}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      }
    >
      <div className="max-w-3xl space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-sm">Client</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">{client?.name ?? "No client"}</p>
            {client?.company && (
              <p className="text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />{client.company}
              </p>
            )}
            {client?.email && (
              <p className="text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />{client.email}
              </p>
            )}
            {client?.phone && (
              <p className="text-muted-foreground flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />{client.phone}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Quote number</p><p className="font-medium">{quote.doc_number ?? "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Created</p><p className="font-medium">{shortDate(quote.created_at)}</p></div>
              <div><p className="text-muted-foreground text-xs">Expires</p><p className="font-medium">{shortDate(quote.expires_at)}</p></div>
              <div><p className="text-muted-foreground text-xs">Status</p><Badge variant={statusColour[quote.status] ?? "muted"}>{quote.status}</Badge></div>
              {quote.project_title && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Project name</p>
                  <p className="font-medium">{quote.project_title}</p>
                </div>
              )}
              {linkedProject && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Linked project</p>
                  <Link href={`/projects/${linkedProject.id}`} className="font-medium text-primary hover:underline">
                    {linkedProject.title}
                  </Link>
                </div>
              )}
            </div>
            {quote.status === "sent" && (
              <div className="mt-3 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Client acceptance link</p>
                <p className="text-xs font-mono break-all">{publicUrl}</p>
              </div>
            )}
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
                      <p className="font-medium">{(item as any).title || item.description}</p>
                      {(item as any).title && item.description && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">{item.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">{item.quantity}</td>
                    <td className="px-5 py-3 text-right">{formatZAR(item.unit_price)}</td>
                    <td className="px-5 py-3 text-right font-semibold">{formatZAR(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-border px-5 py-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{formatZAR(quote.subtotal)}</span>
              </div>
              {quote.travel_cost > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Travel</span><span>{formatZAR(quote.travel_cost)}</span>
                </div>
              )}
              {quote.discount_amount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount</span><span>-{formatZAR(quote.discount_amount)}</span>
                </div>
              )}
              {vatOn && (
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT ({quote.vat_rate}%)</span><span>{formatZAR(quote.vat_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                <span>{vatOn ? "Total (incl. VAT)" : "Total"}</span><span>{formatZAR(quote.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {quote.terms_enabled && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Payment schedule</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { label: quote.terms_deposit_label ?? "Deposit", pct: quote.terms_deposit_pct },
                { label: quote.terms_progress_label ?? "Progress payment", pct: quote.terms_progress_pct },
                { label: quote.terms_final_label ?? "Final payment on completion", pct: quote.terms_final_pct },
              ].filter(t => t.pct).map((term, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <div>
                    <p className="font-medium">{term.label}</p>
                    <p className="text-xs text-muted-foreground">{term.pct}% of total</p>
                  </div>
                  <p className="font-semibold text-base">{formatZAR(quote.total * term.pct / 100)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {quote.notes && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
