import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, workspaces(id)")
    .eq("id", params.id)
    .single()

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 })

  const workspaceId = (quote.workspaces as any)?.id
  if (!workspaceId) return NextResponse.json({ error: "Workspace not found" }, { status: 400 })

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      quote_id: quote.id,
      client_id: quote.client_id,
      title: quote.project_title ?? quote.doc_number ?? "New Project",
      status: "active",
      completion_pct: 0,
    })
    .select()
    .single()

  if (error || !project) return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 })

  await supabase.from("quotes").update({ status: "accepted" }).eq("id", params.id)

  await supabase.from("project_activity").insert({
    project_id: project.id,
    activity_type: "status_change",
    body: `Project created from quote ${quote.doc_number}`,
  })

  return NextResponse.json(project, { status: 201 })
}
