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
import { PageSkeleton } from "@/components/ui/skeleton"
import { Pencil, Check, X, Trash2 } from "lucide-react"

export default function ProductDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const [product, setProduct] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from("products").select("*").eq("id", id).single().then(({ data }) => { setProduct(data); setForm(data ?? {}) })
  }, [id])

  function set(field: string, value: any) { setForm((f: any) => ({ ...f, [field]: value })) }

  async function save() {
    setSaving(true)
    const { data } = await supabase.from("products").update({ ...form, unit_price: parseFloat(form.unit_price) || 0 }).eq("id", id).select().single()
    setProduct(data); setEditing(false); setSaving(false)
  }

  async function deleteProduct() {
    if (!confirm("Delete this product? This cannot be undone.")) return
    await supabase.from("products").delete().eq("id", id)
    router.push("/products")
  }

  if (!product) return <DashboardLayout title="Product"><PageSkeleton /></DashboardLayout>

  return (
    <DashboardLayout
      title={product.name}
      actions={
        editing ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}><Check className="w-3.5 h-3.5" />{saving ? "Saving…" : "Save"}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setForm(product); setEditing(false) }}><X className="w-3.5 h-3.5" />Cancel</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5" />Edit</Button>
            <Button size="sm" variant="destructive" onClick={deleteProduct}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        )
      }
    >
      <div className="max-w-xl">
        <Card>
          <CardHeader><CardTitle className="text-sm">Product details</CardTitle></CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1"><label className="text-xs font-medium">Name</label><Input value={form.name ?? ""} onChange={e => set("name", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-xs font-medium">SKU</label><Input value={form.sku ?? ""} onChange={e => set("sku", e.target.value)} /></div>
                  <div className="space-y-1"><label className="text-xs font-medium">Unit</label><Input value={form.unit ?? ""} onChange={e => set("unit", e.target.value)} /></div>
                </div>
                <div className="space-y-1"><label className="text-xs font-medium">Unit price (R)</label><Input type="number" min="0" step="0.01" value={form.unit_price ?? ""} onChange={e => set("unit_price", e.target.value)} /></div>
                <div className="space-y-1"><label className="text-xs font-medium">Description</label><Textarea value={form.description ?? ""} onChange={e => set("description", e.target.value)} rows={3} /></div>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_taxable ?? true} onChange={e => set("is_taxable", e.target.checked)} />VAT applicable</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active ?? true} onChange={e => set("is_active", e.target.checked)} />Active</label>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-2xl">{formatZAR(product.unit_price)}</p>
                    <p className="text-muted-foreground">per {product.unit ?? "unit"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={product.is_active ? "success" : "muted"}>{product.is_active ? "Active" : "Inactive"}</Badge>
                    <Badge variant={product.is_taxable ? "default" : "secondary"}>{product.is_taxable ? "VAT incl." : "No VAT"}</Badge>
                  </div>
                </div>
                {product.sku && <p className="text-muted-foreground">SKU: <span className="font-mono text-foreground">{product.sku}</span></p>}
                {product.description && <p className="text-muted-foreground">{product.description}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
