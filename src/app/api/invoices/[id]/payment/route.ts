import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const body = await request.json()
  const { amount, method, reference, notes, paid_at } = body

  if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 })

  const { data: invoice } = await supabase.from("invoices").select("id, total, amount_paid, status").eq("id", params.id).single()
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  // Insert payment record
  const { data: payment, error } = await supabase.from("payments").insert({
    invoice_id: params.id, amount, method: method ?? "eft", reference, notes,
    paid_at: paid_at ?? new Date().toISOString(),
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update invoice amount_paid and status
  const newAmountPaid = (invoice.amount_paid ?? 0) + amount
  const newStatus = newAmountPaid >= invoice.total ? "paid" : invoice.status
  await supabase.from("invoices").update({ amount_paid: newAmountPaid, status: newStatus, paid_at: newStatus === "paid" ? new Date().toISOString() : null }).eq("id", params.id)

  return NextResponse.json(payment, { status: 201 })
}
