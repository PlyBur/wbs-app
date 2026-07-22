import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("invoices")
    .select("*, clients(name, company)")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const {
    client_id, due_date, notes,
    subtotal, travel_cost, discount_amount,
    vat_rate, vat_amount, total,
    items,
  } = body

  const { data: workspace } = await supabase.from("workspaces").select("id").single()
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })

  // Generate doc number
  const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true })
  const docNumber = `INV-${String((count ?? 0) + 1).padStart(5, "0")}`

  // Create standalone invoice (no project_id)
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      workspace_id:    workspace.id,
      client_id:       client_id ?? null,
      project_id:      null,
      doc_number:      docNumber,
      status:          "issued",
      due_date:        due_date ?? null,
      notes:           notes || null,
      subtotal:        subtotal ?? 0,
      travel_cost:     travel_cost ?? 0,
      discount_amount: discount_amount ?? 0,
      vat_rate:        vat_rate ?? 0,
      vat_amount:      vat_amount ?? 0,
      total:           total ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert line items
  const validItems = (items ?? []).filter((i: any) => i.title?.trim())
  if (validItems.length > 0) {
    await supabase.from("invoice_line_items").insert(
      validItems.map((item: any, idx: number) => ({
        invoice_id:  invoice.id,
        title:       item.title,
        description: item.description || null,
        quantity:    item.quantity,
        unit_price:  item.unit_price,
        is_taxable:  item.is_taxable ?? true,
        sort_order:  idx,
      }))
    )
  }

  return NextResponse.json(invoice, { status: 201 })
}
