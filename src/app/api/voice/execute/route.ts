import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ParsedCommand } from "@/lib/voice-parser"

export async function POST(request: Request) {
  const supabase = await createClient()
  const command: ParsedCommand = await request.json()

  if (!command.projectId && command.action !== "unknown") {
    return NextResponse.json({ error: "No project identified" }, { status: 400 })
  }

  const today = new Date().toISOString().split("T")[0]
  const { data: workspace } = await supabase.from("workspaces").select("id").single()
  const wsId = workspace?.id

  switch (command.action) {
    case "log_interaction": {
      const { data, error } = await supabase
        .from("project_interactions")
        .insert({
          project_id: command.projectId,
          workspace_id: wsId,
          interaction_date: today,
          type: command.interactionType ?? "other",
          summary: command.summary ?? command.rawTranscript,
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, data, message: command.humanReadable })
    }

    case "add_expense": {
      if (!command.amount) return NextResponse.json({ error: "No amount found" }, { status: 400 })
      const { data, error } = await supabase
        .from("project_expenses")
        .insert({
          project_id: command.projectId,
          workspace_id: wsId,
          expense_date: today,
          category: command.category ?? "other",
          description: command.expenseDescription ?? command.rawTranscript,
          quantity: 1,
          unit_cost: command.amount,
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, data, message: command.humanReadable })
    }

    case "create_task": {
      // Get current task count for sort_order
      const { count } = await supabase
        .from("project_tasks")
        .select("*", { count: "exact", head: true })
        .eq("project_id", command.projectId!)
      const { data, error } = await supabase
        .from("project_tasks")
        .insert({
          project_id: command.projectId,
          title: command.taskTitle ?? command.rawTranscript,
          status: "todo",
          sort_order: count ?? 0,
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, data, message: command.humanReadable })
    }

    case "update_status": {
      const { error } = await supabase
        .from("projects")
        .update({ status: command.newStatus })
        .eq("id", command.projectId!)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, message: command.humanReadable })
    }

    default:
      return NextResponse.json({ error: "Unknown command" }, { status: 400 })
  }
}
