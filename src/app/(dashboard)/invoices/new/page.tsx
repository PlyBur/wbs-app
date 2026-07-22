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

export default function NewInvoicePage() {
  const router = useRouter()
  const supabase = createClient()
  const [clients, setClients] = useState<any[]>([])
  const [workspace, setWorkspace] = useState<any>(null)
  const [clientId, setClientId] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [travelCost, setTravelCost] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [items, setItems] = useState<LineItem[]>([{ title: "", description: "", quantity: 1, unit_price: 0, is_taxable: true }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => setClients(data ?? []))
    fetch("/api/settings").then(r => r.json()).then(ws => {
      setWorkspace(ws)
      const d = new Date(); d.setDate(d.getDate() + (ws.invoice_due_days ?? 30))
      setDueDate(d.toISOString().split("T")[0])
      if (ws.invoice_notes) setNotes(ws.invoice_notes)
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
    setSaving(true)
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId || null,
        due_date: dueDate || null,
        notes: notes || null,
        subtotal, travel_cost: travelCost, discount_amount: discount,
        vat_rate: vatRate, vat_amount: vatAmount, total,
        items,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast(data.error ?? "Failed to create invoice", "error")
      setSaving(false)
    } else {
      router.push(`/invoices/${data.id}`)
    }
  }

  return (
    <DashboardLayout title="New invoice">
      <form onSubmit={save} className="max-w-3xl space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-sm">Invoice details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Client (optional)</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none">
                  <option value="">No client / cash sale</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Due date</label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
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
          <CardContent className="space-y-4 p-0">
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
          <CardHeader><CardTitle className="text-sm">Totals</CardTitle></CardHeader>
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
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create invoice"}</Button>
          </CardContent>
        </Card>
      </form>
    </DashboardLayout>
  )
}
