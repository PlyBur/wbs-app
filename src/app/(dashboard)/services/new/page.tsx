"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"

export default function NewServicePage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ name: "", description: "", default_rate: "", unit: "hr", pricing_type: "hourly", is_taxable: true, is_active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string, value: any) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: workspace } = await supabase.from("workspaces").select("id").single()
    if (!workspace) { setError("Workspace not found."); setSaving(false); return }
    const { error: err } = await supabase.from("services").insert({
      ...form, default_rate: parseFloat(form.default_rate) || 0, workspace_id: workspace.id,
    })
    if (err) { setError(err.message); setSaving(false); return }
    router.push("/services")
  }

  return (
    <DashboardLayout title="New Service">
      <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-sm">Service details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1"><label className="text-sm font-medium">Name *</label><Input placeholder="e.g. Installation labour" value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Pricing type</label>
                <select value={form.pricing_type} onChange={e => set("pricing_type", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="hourly">Hourly</option>
                  <option value="fixed">Fixed price</option>
                  <option value="per_unit">Per unit</option>
                </select>
              </div>
              <div className="space-y-1"><label className="text-sm font-medium">Unit</label><Input placeholder="hr / day / job" value={form.unit} onChange={e => set("unit", e.target.value)} /></div>
            </div>
            <div className="space-y-1"><label className="text-sm font-medium">Default rate (R) *</label><Input type="number" min="0" step="0.01" placeholder="0.00" value={form.default_rate} onChange={e => set("default_rate", e.target.value)} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Description</label><Textarea placeholder="Optional description" value={form.description} onChange={e => set("description", e.target.value)} rows={2} /></div>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_taxable} onChange={e => set("is_taxable", e.target.checked)} /> VAT applicable</label>
            </div>
          </CardContent>
        </Card>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button type="submit" disabled={!form.name || saving}>{saving ? "Saving…" : "Save service"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </DashboardLayout>
  )
}
