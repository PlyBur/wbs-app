"use client"

import { useEffect, useRef, useState } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { PageSkeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [ws, setWs] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(setWs)
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ws),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function uploadLogo(file: File) {
    setUploadingLogo(true)
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/logo", { method: "POST", body: form })
    const data = await res.json()
    if (data.url) setWs((w: any) => ({ ...w, logo_url: data.url }))
    setUploadingLogo(false)
  }

  function set(key: string, val: any) {
    setWs((w: any) => ({ ...w, [key]: val }))
  }

  if (!ws) return <DashboardLayout title="Settings"><PageSkeleton /></DashboardLayout>

  return (
    <DashboardLayout title="Settings">
      <form onSubmit={save} className="max-w-2xl space-y-5">

        <Card>
          <CardHeader><CardTitle className="text-sm">Business profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Logo</label>
              <div className="flex items-center gap-4">
                {ws.logo_url
                  ? <img src={ws.logo_url} alt="Logo" className="h-14 max-w-[160px] object-contain rounded border border-border" />
                  : <div className="w-14 h-14 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">W</div>
                }
                <div>
                  <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadingLogo}>
                    {uploadingLogo ? "Uploading…" : "Upload logo"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">PNG or SVG, shown on quotes and invoices</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Business name</label>
                <Input value={ws.name ?? ""} onChange={e => set("name", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Registration number</label>
                <Input value={ws.registration_number ?? ""} onChange={e => set("registration_number", e.target.value)} placeholder="e.g. 2023/123456/07" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">VAT number</label>
                <Input value={ws.vat_number ?? ""} onChange={e => set("vat_number", e.target.value)} placeholder="e.g. 4123456789" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Business address</label>
                <Input value={ws.address ?? ""} onChange={e => set("address", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <Input value={ws.phone ?? ""} onChange={e => set("phone", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <Input value={ws.email ?? ""} onChange={e => set("email", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Tax settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="vat_registered"
                checked={ws.vat_registered !== false}
                onChange={e => set("vat_registered", e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <label htmlFor="vat_registered" className="text-sm font-medium cursor-pointer">VAT registered</label>
            </div>
            {ws.vat_registered !== false && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Default VAT rate (%)</label>
                  <Input type="number" value={ws.default_vat_rate ?? 15} onChange={e => set("default_vat_rate", parseFloat(e.target.value))} min="0" max="100" step="0.1" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Invoice defaults</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Payment terms (days)</label>
                <Input type="number" value={ws.invoice_due_days ?? 30} onChange={e => set("invoice_due_days", parseInt(e.target.value))} min="0" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Quote validity (days)</label>
                <Input type="number" value={ws.quote_validity_days ?? 30} onChange={e => set("quote_validity_days", parseInt(e.target.value))} min="1" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Invoice notes / footer</label>
              <textarea
                value={ws.invoice_notes ?? ""}
                onChange={e => set("invoice_notes", e.target.value)}
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none resize-none mt-1"
                placeholder="e.g. Thank you for your business. Payment due within 30 days."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Payment terms (default for quotes)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">These defaults pre-fill when creating a new quote with payment terms enabled.</p>
            {[
              { key: "deposit",  defaultLabel: "Deposit" },
              { key: "progress", defaultLabel: "Progress payment" },
              { key: "final",    defaultLabel: "Final payment on completion" },
            ].map(term => (
              <div key={term.key} className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Label</label>
                  <Input
                    value={ws[`terms_${term.key}_label`] ?? term.defaultLabel}
                    onChange={e => set(`terms_${term.key}_label`, e.target.value)}
                    placeholder={term.defaultLabel}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">%</label>
                  <Input
                    type="number"
                    value={ws[`terms_${term.key}_pct`] ?? ""}
                    onChange={e => set(`terms_${term.key}_pct`, e.target.value ? parseFloat(e.target.value) : null)}
                    min="0" max="100" placeholder="e.g. 30"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Banking details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Bank name</label>
                <Input value={ws.bank_name ?? ""} onChange={e => set("bank_name", e.target.value)} placeholder="e.g. FNB" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Account holder</label>
                <Input value={ws.bank_account_holder ?? ""} onChange={e => set("bank_account_holder", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Account number</label>
                <Input value={ws.bank_account_number ?? ""} onChange={e => set("bank_account_number", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Branch code</label>
                <Input value={ws.bank_branch_code ?? ""} onChange={e => set("bank_branch_code", e.target.value)} placeholder="e.g. 250655" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 pb-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
          {saved && <p className="text-sm text-success">Saved!</p>}
        </div>
      </form>
    </DashboardLayout>
  )
}
