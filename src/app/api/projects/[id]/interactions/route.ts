import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_interactions")
    .select("*")
    .eq("project_id", params.id)
    .order("interaction_date", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const body = await request.json()
  const { data: ws } = await supabase.from("workspaces").select("id").single()
  const { data, error } = await supabase.from("project_interactions").insert({
    project_id: params.id,
    workspace_id: ws?.id,
    interaction_date: body.interaction_date,
    type: body.type,
    contact_person: body.contact_person || null,
    summary: body.summary,
    next_action: body.next_action || null,
    next_action_date: body.next_action_date || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const interactionId = searchParams.get("interactionId")
  if (!interactionId) return NextResponse.json({ error: "Missing interactionId" }, { status: 400 })
  const { error } = await supabase.from("project_interactions").delete().eq("id", interactionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
