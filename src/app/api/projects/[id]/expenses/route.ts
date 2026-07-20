import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_expenses")
    .select("*")
    .eq("project_id", params.id)
    .order("expense_date", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const body = await request.json()
  const { data: ws } = await supabase.from("workspaces").select("id").single()
  const { data, error } = await supabase.from("project_expenses").insert({
    project_id: params.id,
    workspace_id: ws?.id,
    expense_date: body.expense_date,
    category: body.category,
    description: body.description,
    supplier: body.supplier || null,
    quantity: body.quantity || 1,
    unit_cost: body.unit_cost,
    notes: body.notes || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const expenseId = searchParams.get("expenseId")
  if (!expenseId) return NextResponse.json({ error: "Missing expenseId" }, { status: 400 })
  const { error } = await supabase.from("project_expenses").delete().eq("id", expenseId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
