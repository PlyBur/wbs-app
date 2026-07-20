import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const TERM_SUFFIX: Record<string, string> = {
  deposit: "D",
  progress: "P",
  final: "F",
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  let termType: string | null = null
  try {
    const body = await request.json()
    termType = body?.termType ?? null
  } catch { /* no body — full invoice */ }

  const { data: project } = await supabase
    .from("projects")
    .select("*, quotes(*, quote_line_items(*))")
    .eq("id", params.id)
    .single()

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, default_vat_rate, invoice_due_days, vat_registered")
    .single()

  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 400 })

  const quote = project.quotes as any
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (workspace.invoice_due_days ?? 30))
  const dueDateStr = dueDate.toISOString().split("T")[0]

  // Term invoice (deposit / progress / final)
  if (termType && quote?.terms_enabled) {
    const pctMap: Record<string, number | null> = {
      deposit:  quote.terms_deposit_pct  ?? null,
      progress: quote.terms_progress_pct ?? null,
      final:    quote.terms_final_pct    ?? null,
    }
    const labelMap: Record<string, string> = {
      deposit:  quote.terms_deposit_label  ?? "Deposit",
      progress: quote.terms_progress_label ?? "Progress payment",
      final:    quote.terms_final_label    ?? "Final payment on completion",
    }

    const pct = pctMap[termType]
    if (!pct) {
      return NextResponse.json({ error: `No percentage set for term: ${termType}` }, { status: 400 })
    }

    const termLabel = labelMap[termType]
    const amount = Math.round(quote.total * pct / 100 * 100) / 100

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        workspace_id: workspace.id,
        project_id: project.id,
        client_id: project.client_id,
        status: "issued",
        sent_at: new Date().toISOString(),
        subtotal: amount,
        travel_cost: 0,
        discount_amount: 0,
        vat_rate: 0,
        vat_amount: 0,
        total: amount,
        due_date: dueDateStr,
        term_type: termType,
        term_label: termLabel,
      })
      .select()
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 })
    }

    const suffix = TERM_SUFFIX[termType] ?? termType.slice(0, 1).toUpperCase()
    const newDocNumber = `${invoice.doc_number}-${suffix}`
    await supabase.from("invoices").update({ doc_number: newDocNumber }).eq("id", invoice.id)
    invoice.doc_number = newDocNumber

    await supabase.from("invoice_line_items").insert({
      invoice_id: invoice.id,
      title: `${termLabel} (${pct}%)`,
      description: project.title ?? null,
      quantity: 1,
      unit_price: amount,
      is_taxable: false,
      sort_order: 0,
    })

    await supabase.from("project_activity").insert({
      project_id: project.id,
      activity_type: "invoice_sent",
      body: `${termLabel} invoice ${newDocNumber} generated (${pct}% · ${formatZAR(amount)})`,
    })

    return NextResponse.json(invoice, { status: 201 })
  }

  // Full invoice from quote line items
  const lineItems: any[] = quote?.quote_line_items ?? []
  const vatRegistered = workspace.vat_registered !== false
  const vatRate = vatRegistered ? (workspace.default_vat_rate ?? 15) : 0
  const subtotal = lineItems.reduce((s: number, item: any) => s + item.quantity * item.unit_price, 0)
  const taxable = vatRegistered
    ? lineItems.filter((i: any) => i.is_taxable).reduce((s: number, item: any) => s + item.quantity * item.unit_price, 0)
    : 0
  const travelCost = quote?.travel_cost ?? 0
  const discount = quote?.discount_amount ?? 0
  const vatAmount = vatRegistered
    ? Math.round((taxable + travelCost - discount) * (vatRate / 100) * 100) / 100
    : 0
  const total = subtotal + travelCost - discount + vatAmount

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      workspace_id: workspace.id,
      project_id: project.id,
      client_id: project.client_id,
      status: "issued",
      sent_at: new Date().toISOString(),
      subtotal,
      travel_cost: travelCost,
      discount_amount: discount,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total,
      due_date: dueDateStr,
    })
    .select()
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 })
  }

  if (lineItems.length > 0) {
    await supabase.from("invoice_line_items").insert(
      lineItems.map((item: any, i: number) => ({
        invoice_id: invoice.id,
        item_type: item.item_type,
        product_id: item.product_id,
        service_id: item.service_id,
        title: item.title ?? item.description,
        description: item.title ? (item.description ?? null) : null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        is_taxable: item.is_taxable,
        sort_order: i,
      }))
    )
  }

  await supabase.from("project_activity").insert({
    project_id: project.id,
    activity_type: "invoice_sent",
    body: `Invoice ${invoice.doc_number} generated`,
  })

  return NextResponse.json(invoice, { status: 201 })
}

function formatZAR(n: number) {
  const [i, d] = (n || 0).toFixed(2).split(".")
  return "R " + i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + d
}
