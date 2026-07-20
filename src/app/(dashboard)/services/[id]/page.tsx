"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { formatZAR } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Pencil, Check, X, Trash2 } from "lucide-react"

export default function ServiceDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const [service, setService] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from("services").select("*").eq("id", id).single().then(({ data }) => { setService(data); setForm(data ?? {}) })
  }, [id])

  function set(field: string, value: any) { setForm((f: any) => ({ ...f, [field]: value })) }

  async function save() {
    setSaving(true)
    const { data } = await supabase.from("services").update({ ...form, default_rate: parseFloat(form.default_rate) || 0 }).eq("id", id).select().single()
    setService(data); setEditing(false); setSaving(false)
  }

  async function deleteService() {
    if (!confirm("Delete this service?")) return
    await supabase.from("services").delete().eq("id", id)
    router.push("/services")
  }

  if (!service) return <DashboardLayout title="Service"><p className="text-muted-foreground text-sm">Loading…</p></DashboardLayout>

  return (
    <DashboardLayout
      title={service.name}
      actions={
        editing ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}><Check className="w-3.5 h-3.5" />{saving ? "Saving…" : "Save"}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setForm(service); setEditing(false) }}><X className="w-3.5 h-3.5" />Cancel</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5" />Edit</Button>
            <Button size="sm" variant="destructive" onClick={deleteService}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        )
      }
    >
      <div className="max-w-xl">
        <Card>
          <CardHeader><CardTitle className="text-sm">Service details</CardTitle></CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1"><label className="text-xs font-medium">Name</label><Input value={form.name ?? ""} onChange={e => set("name", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Pricing type</label>
                    <select value={form.pricing_type ?? "hourly"} onChange={e => set("pricing_type", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="hourly">Hourly</option><option value="fixed">Fixed</option><option value="per_unit">Per unit</option>
                    </select>
                  </div>
                  <div className="space-y-1"><label className="text-xs font-medium">Unit</label><Input value={form.unit ?? ""} onChange={e => set("unit", e.target.value)} /></div>
                </div>
                <div className="space-y-1"><label className="text-xs font-medium">Default rate (R)</label><Input type="number" min="0" step="0.01" value={form.default_rate ?? ""} onChange={e => set("default_rate", e.target.value)} /></div>
                <div className="space-y-1"><label className="text-xs font-medium">Description</label><Textarea value={form.description ?? ""} onChange={e => set("description", e.target.value)} rows={3} /></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_taxable ?? true} onChange={e => set("is_taxable", e.target.checked)} />VAT applicable</label>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-2xl">{formatZAR(service.default_rate)}</p>
                    <p className="text-muted-foreground">per {service.unit ?? "hr"}</p>
                  </div>
                  <Badge variant="default">{service.pricing_type}</Badge>
                </div>
                {service.description && <p className="text-muted-foreground">{service.description}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
