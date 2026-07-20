import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const id = params.id

  // 1. Find all invoices for this project
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("project_id", id)

  if (invoices && invoices.length > 0) {
    const invoiceIds = invoices.map(i => i.id)

    // 2. Delete payments tied to those invoices
    await supabase.from("payments").delete().in("invoice_id", invoiceIds)

    // 3. Delete invoice line items
    await supabase.from("invoice_line_items").delete().in("invoice_id", invoiceIds)

    // 4. Delete the invoices
    await supabase.from("invoices").delete().in("id", invoiceIds)
  }

  // 5. Find the linked quote and clean it up
  const { data: project } = await supabase
    .from("projects")
    .select("quote_id")
    .eq("id", id)
    .single()

  if (project?.quote_id) {
    await supabase.from("quote_line_items").delete().eq("quote_id", project.quote_id)
    await supabase.from("quotes").delete().eq("id", project.quote_id)
  }

  // 6. Delete the project itself (cascades tasks, interactions, expenses, images via DB FK)
  const { error } = await supabase.from("projects").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
