"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"

export default function NewClientPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    name: "", client_type: "individual", company: "", email: "",
    phone: "", whatsapp_number: "", vat_number: "",
    address_line1: "", address_city: "", address_province: "", address_postal_code: "", notes: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { data: workspace } = await supabase.from("workspaces").select("id").single()
    if (!workspace) { setError("Workspace not found. Run the workspace SQL first."); setSaving(false); return }
    const { data, error: err } = await supabase.from("clients")
      .insert({ ...form, workspace_id: workspace.id })
      .select().single()
    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/clients`)
  }

  const field = (label: string, key: string, type = "text", placeholder = "") => (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <Input type={type} placeholder={placeholder} value={(form as any)[key]} onChange={e => set(key, e.target.value)} />
    </div>
  )

  return (
    <DashboardLayout title="New Client">
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-sm">Basic info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <select value={form.client_type} onChange={e => set("client_type", e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
            </div>
            {field("Full name *", "name", "text", "Jane Smith")}
            {field("Company", "company", "text", "Acme Pty Ltd")}
            {field("VAT number", "vat_number")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Contact details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {field("Email", "email", "email", "jane@company.co.za")}
            {field("Phone", "phone", "tel", "+27 82 000 0000")}
            {field("WhatsApp number", "whatsapp_number", "tel", "+27 82 000 0000")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Address</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {field("Street address", "address_line1")}
            <div className="grid grid-cols-3 gap-3">
              {field("City", "address_city")}
              {field("Province", "address_province")}
              {field("Postal code", "address_postal_code")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea placeholder="Any extra info about this client…" value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} />
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={!form.name || saving}>{saving ? "Saving…" : "Save client"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </DashboardLayout>
  )
}
