"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"

export default function NewProductPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ name: "", sku: "", description: "", unit_price: "", unit: "unit", is_taxable: true, is_active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string, value: any) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: workspace } = await supabase.from("workspaces").select("id").single()
    if (!workspace) { setError("Workspace not found."); setSaving(false); return }
    const { error: err } = await supabase.from("products").insert({
      ...form, unit_price: parseFloat(form.unit_price) || 0, workspace_id: workspace.id,
    })
    if (err) { setError(err.message); setSaving(false); return }
    router.push("/products")
  }

  return (
    <DashboardLayout title="New Product">
      <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-sm">Product details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1"><label className="text-sm font-medium">Name *</label><Input placeholder="e.g. Copper cable 2.5mm" value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-sm font-medium">SKU</label><Input placeholder="CAB-250" value={form.sku} onChange={e => set("sku", e.target.value)} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Unit</label><Input placeholder="m / unit / box" value={form.unit} onChange={e => set("unit", e.target.value)} /></div>
            </div>
            <div className="space-y-1"><label className="text-sm font-medium">Unit price (R) *</label><Input type="number" min="0" step="0.01" placeholder="0.00" value={form.unit_price} onChange={e => set("unit_price", e.target.value)} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Description</label><Textarea placeholder="Optional description" value={form.description} onChange={e => set("description", e.target.value)} rows={2} /></div>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_taxable} onChange={e => set("is_taxable", e.target.checked)} /> VAT applicable</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} /> Active</label>
            </div>
          </CardContent>
        </Card>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button type="submit" disabled={!form.name || saving}>{saving ? "Saving…" : "Save product"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </DashboardLayout>
  )
}
