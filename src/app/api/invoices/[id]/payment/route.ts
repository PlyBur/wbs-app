import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const body = await request.json()
  const { amount, method, reference, notes, paid_at } = body

  if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 })

  const { data: invoice } = await supabase.from("invoices").select("id, total, status").eq("id", params.id).single()
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  // Insert payment record
  const { data: payment, error } = await supabase.from("payments").insert({
    invoice_id: params.id, amount, method: method ?? "eft", reference, notes,
    paid_at: paid_at ?? new Date().toISOString(),
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute total paid from payments table (avoids depending on amount_paid column)
  const { data: existingPmts } = await supabase.from("payments").select("amount").eq("invoice_id", params.id)
  const totalPaid = (existingPmts ?? []).reduce((s: number, p: any) => s + p.amount, 0)
  const newStatus = totalPaid >= invoice.total ? "paid" : invoice.status === "draft" ? "issued" : invoice.status

  // Update invoice status
  await supabase.from("invoices").update({ status: newStatus }).eq("id", params.id)

  return NextResponse.json(payment, { status: 201 })
}
