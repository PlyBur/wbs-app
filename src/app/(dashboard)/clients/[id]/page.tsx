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
import { PageSkeleton } from "@/components/ui/skeleton"
import { Mail, Phone, Building2, MapPin, Pencil, Trash2, X, Check } from "lucide-react"
import Link from "next/link"

export default function ClientDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [client, setClient] = useState<any>(null)
  const [quotes, setQuotes] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from("clients").select("*").eq("id", id).single().then(({ data }) => {
      setClient(data); setForm(data ?? {})
    })
    supabase.from("quotes").select("id, doc_number, status, total, created_at").eq("client_id", id).order("created_at", { ascending: false }).then(({ data }) => setQuotes(data ?? []))
    supabase.from("projects").select("id, title, status, completion_pct, created_at").eq("client_id", id).order("created_at", { ascending: false }).then(({ data }) => setProjects(data ?? []))
  }, [id])

  async function save() {
    setSaving(true)
    const { data } = await supabase.from("clients").update(form).eq("id", id).select().single()
    setClient(data); setEditing(false); setSaving(false)
  }

  async function deleteClient() {
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return
    await fetch(`/api/clients/${id}`, { method: "DELETE" })
    router.refresh()
    router.push("/clients")
  }

  if (!client) return <DashboardLayout title="Client"><PageSkeleton /></DashboardLayout>

  const statusColourQ: Record<string, any> = { draft: "muted", sent: "default", accepted: "success", declined: "destructive", expired: "warning" }
  const statusColourP: Record<string, any> = { pending: "muted", active: "default", on_hold: "warning", completed: "success" }

  return (
    <DashboardLayout
      title={client.name}
      actions={
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" onClick={save} disabled={saving}><Check className="w-3.5 h-3.5" />{saving ? "Saving…" : "Save"}</Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm(client) }}><X className="w-3.5 h-3.5" />Cancel</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5" />Edit</Button>
              <Button size="sm" variant="destructive" onClick={deleteClient}><Trash2 className="w-3.5 h-3.5" /></Button>
            </>
          )}
        </div>
      }
    >
      <div className="max-w-3xl space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-sm">Contact details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Name *</label><Input value={form.name ?? ""} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground">Company</label><Input value={form.company ?? ""} onChange={e => setForm((f: any) => ({ ...f, company: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground">Email</label><Input value={form.email ?? ""} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground">Phone</label><Input value={form.phone ?? ""} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground">VAT number</label><Input value={form.vat_number ?? ""} onChange={e => setForm((f: any) => ({ ...f, vat_number: e.target.value }))} /></div>
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Address</label><Input value={form.address ?? ""} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Notes</label><textarea value={form.notes ?? ""} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none resize-none" /></div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-base">{client.name}</p>
                {client.company && <p className="text-muted-foreground flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{client.company}</p>}
                {client.email && <p className="text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{client.email}</p>}
                {client.phone && <p className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{client.phone}</p>}
                {client.address && <p className="text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{client.address}</p>}
                {client.vat_number && <p className="text-muted-foreground text-xs">VAT: {client.vat_number}</p>}
                {client.notes && <p className="text-muted-foreground text-xs mt-2 whitespace-pre-wrap border-t border-border pt-2">{client.notes}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {quotes.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Quotes</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {quotes.map(q => (
                  <li key={q.id}>
                    <Link href={`/quotes/${q.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors text-sm">
                      <div><p className="font-medium">{q.doc_number}</p><p className="text-xs text-muted-foreground">{shortDate(q.created_at)}</p></div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{formatZAR(q.total)}</span>
                        <Badge variant={statusColourQ[q.status] ?? "muted"}>{q.status}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {projects.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Projects</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {projects.map(p => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors text-sm">
                      <div><p className="font-medium">{p.title}</p><p className="text-xs text-muted-foreground">{shortDate(p.created_at)}</p></div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{p.completion_pct ?? 0}%</span>
                        <Badge variant={statusColourP[p.status] ?? "muted"}>{p.status}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
