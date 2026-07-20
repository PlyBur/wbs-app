"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatZAR } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/lib/toast"
import { Plus, Trash2 } from "lucide-react"

interface LineItem { title: string; description: string; quantity: number; unit_price: number; is_taxable: boolean }

export default function NewQuotePage() {
  const router = useRouter()
  const supabase = createClient()
  const [clients, setClients] = useState<any[]>([])
  const [workspace, setWorkspace] = useState<any>(null)
  const [clientId, setClientId] = useState("")
  const [projectTitle, setProjectTitle] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [notes, setNotes] = useState("")
  const [travelCost, setTravelCost] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [termsEnabled, setTermsEnabled] = useState(false)
  const [terms, setTerms] = useState({
    deposit_label: "Deposit", deposit_pct: 30,
    progress_label: "Progress payment", progress_pct: 40,
    final_label: "Final payment on completion", final_pct: 30,
  })
  const [items, setItems] = useState<LineItem[]>([{ title: "", description: "", quantity: 1, unit_price: 0, is_taxable: true }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => setClients(data ?? []))
    fetch("/api/settings").then(r => r.json()).then(ws => {
      setWorkspace(ws)
      const d = new Date(); d.setDate(d.getDate() + (ws.quote_validity_days ?? 30))
      setExpiresAt(d.toISOString().split("T")[0])
      // If the workspace has saved default term percentages, pre-populate the form
      if (ws.terms_deposit_pct || ws.terms_progress_pct || ws.terms_final_pct) {
        setTermsEnabled(true)
        setTerms(t => ({
          ...t,
          deposit_label: ws.terms_deposit_label ?? t.deposit_label,
          deposit_pct: ws.terms_deposit_pct ?? t.deposit_pct,
          progress_label: ws.terms_progress_label ?? t.progress_label,
          progress_pct: ws.terms_progress_pct ?? t.progress_pct,
          final_label: ws.terms_final_label ?? t.final_label,
          final_pct: ws.terms_final_pct ?? t.final_pct,
        }))
      }
    })
  }, [])

  const vatOn = workspace?.vat_registered !== false
  const vatRate = vatOn ? (workspace?.default_vat_rate ?? 15) : 0
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const taxable = vatOn ? items.filter(i => i.is_taxable).reduce((s, i) => s + i.quantity * i.unit_price, 0) : 0
  const vatAmount = vatOn ? Math.round((taxable + travelCost - discount) * (vatRate / 100) * 100) / 100 : 0
  const total = subtotal + travelCost - discount + vatAmount

  function updateItem(i: number, key: keyof LineItem, val: any) {
    setItems(items.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  }
  function addItem() { setItems([...items, { title: "", description: "", quantity: 1, unit_price: 0, is_taxable: true }]) }
  function removeItem(i: number) { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) { toast("Please select a client", "error"); return }
    setSaving(true)
    const { data: ws } = await supabase.from("workspaces").select("id").single()
    const { data: quote, error } = await supabase.from("quotes").insert({
      workspace_id: ws?.id,
      client_id: clientId,
      status: "draft",
      project_title: projectTitle || null,
      expires_at: expiresAt || null,
      notes: notes || null,
      subtotal, travel_cost: travelCost, discount_amount: discount,
      vat_rate: vatRate, vat_amount: vatAmount, total,
      terms_enabled: termsEnabled,
      terms_deposit_label: termsEnabled ? terms.deposit_label : null,
      terms_deposit_pct: termsEnabled ? terms.deposit_pct : null,
      terms_progress_label: termsEnabled ? terms.progress_label : null,
      terms_progress_pct: termsEnabled ? terms.progress_pct : null,
      terms_final_label: termsEnabled ? terms.final_label : null,
      terms_final_pct: termsEnabled ? terms.final_pct : null,
    }).select().single()
    if (error || !quote) { toast(error?.message ?? "Failed to save quote", "error"); setSaving(false); return }
    if (items.filter(i => i.title.trim()).length > 0) {
      await supabase.from("quote_line_items").insert(
        items.filter(i => i.title.trim()).map((item, idx) => ({
          quote_id: quote.id,
          title: item.title,
          description: item.description || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          is_taxable: item.is_taxable,
          sort_order: idx,
        }))
      )
    }
    router.push(`/quotes/${quote.id}`)
  }

  return (
    <DashboardLayout title="New quote">
      <form onSubmit={save} className="max-w-3xl space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-sm">Quote details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Client *</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none" required>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Project / job description</label>
                <Input value={projectTitle} onChange={e => setProjectTitle(e.target.value)} placeholder="e.g. Kitchen renovation" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valid until</label>
                <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Line items</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="w-3.5 h-3.5" />Add item</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {items.map((item, i) => (
              <div key={i} className="px-5 py-4 border-b border-border last:border-0 space-y-2">
                <div className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <Input value={item.title} onChange={e => updateItem(i, "title", e.target.value)} placeholder="Item title *" />
                    <textarea
                      value={item.description}
                      onChange={e => updateItem(i, "description", e.target.value)}
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none resize-none"
                    />
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(i)} className="text-destructive mt-1 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <div><label className="text-xs text-muted-foreground">Qty</label><Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} min="0" step="0.01" /></div>
                  <div><label className="text-xs text-muted-foreground">Unit price</label><Input type="number" value={item.unit_price} onChange={e => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)} min="0" step="0.01" /></div>
                  <div><label className="text-xs text-muted-foreground">Total</label><p className="text-sm font-semibold py-2">{formatZAR(item.quantity * item.unit_price)}</p></div>
                  {vatOn && <div className="flex items-center gap-2 mt-4"><input type="checkbox" checked={item.is_taxable} onChange={e => updateItem(i, "is_taxable", e.target.checked)} id={`vat-${i}`} /><label htmlFor={`vat-${i}`} className="text-xs">VAT</label></div>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Totals &amp; notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="text-xs text-muted-foreground">Travel / call-out cost</label><Input type="number" value={travelCost} onChange={e => setTravelCost(parseFloat(e.target.value) || 0)} min="0" step="0.01" /></div>
              <div><label className="text-xs text-muted-foreground">Discount</label><Input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} min="0" step="0.01" /></div>
            </div>
            <div className="border-t border-border pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatZAR(subtotal)}</span></div>
              {travelCost > 0 && <div className="flex justify-between text-muted-foreground"><span>Travel</span><span>{formatZAR(travelCost)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{formatZAR(discount)}</span></div>}
              {vatOn && <div className="flex justify-between text-muted-foreground"><span>VAT ({vatRate}%)</span><span>{formatZAR(vatAmount)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t border-border pt-2"><span>Total</span><span>{formatZAR(total)}</span></div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none resize-none mt-1" placeholder="Additional notes…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="terms" checked={termsEnabled} onChange={e => setTermsEnabled(e.target.checked)} className="w-4 h-4 rounded border-border" />
              <CardTitle className="text-sm cursor-pointer" onClick={() => setTermsEnabled(v => !v)}>Payment terms</CardTitle>
            </div>
          </CardHeader>
          {termsEnabled && (
            <CardContent className="space-y-3">
              {([["deposit", "Deposit"], ["progress", "Progress payment"], ["final", "Final payment on completion"]] as const).map(([key, placeholder]) => (
                <div key={key} className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-2"><label className="text-xs text-muted-foreground">Label</label><Input value={(terms as any)[`${key}_label`]} onChange={e => setTerms(t => ({ ...t, [`${key}_label`]: e.target.value }))} placeholder={placeholder} /></div>
                  <div><label className="text-xs text-muted-foreground">% of total</label><Input type="number" value={(terms as any)[`${key}_pct`]} onChange={e => setTerms(t => ({ ...t, [`${key}_pct`]: parseFloat(e.target.value) || 0 }))} min="0" max="100" /></div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Total: {(terms.deposit_pct || 0) + (terms.progress_pct || 0) + (terms.final_pct || 0)}%
                {(terms.deposit_pct || 0) + (terms.progress_pct || 0) + (terms.final_pct || 0) !== 100 && <span className="text-destructive"> (should be 100%)</span>}
              </p>
            </CardContent>
          )}
        </Card>

        <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create quote"}</Button>
      </form>
    </DashboardLayout>
  )
}
