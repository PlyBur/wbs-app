import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const command  = await request.json()

  const today = new Date().toISOString().split("T")[0]
  const { data: workspace } = await supabase.from("workspaces").select("id").single()
  const wsId = workspace?.id

  switch (command.action) {

    // ── Log interaction ─────────────────────────────────────────────────────
    case "log_interaction": {
      if (!command.projectId) return NextResponse.json({ error: "No project identified" }, { status: 400 })
      const { data, error } = await supabase
        .from("project_interactions")
        .insert({
          project_id:       command.projectId,
          workspace_id:     wsId,
          interaction_date: today,
          type:             command.interactionType ?? "other",
          summary:          command.summary ?? command.rawTranscript,
        })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, data, message: command.humanReadable })
    }

    // ── Add expense ─────────────────────────────────────────────────────────
    case "add_expense": {
      if (!command.projectId) return NextResponse.json({ error: "No project identified" }, { status: 400 })
      if (!command.amount)    return NextResponse.json({ error: "No amount found" }, { status: 400 })
      const { data, error } = await supabase
        .from("project_expenses")
        .insert({
          project_id:   command.projectId,
          workspace_id: wsId,
          expense_date: today,
          category:     command.category ?? "other",
          description:  command.expenseDescription ?? command.rawTranscript,
          quantity:     1,
          unit_cost:    command.amount,
        })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, data, message: command.humanReadable })
    }

    // ── Create task ─────────────────────────────────────────────────────────
    case "create_task": {
      if (!command.projectId) return NextResponse.json({ error: "No project identified" }, { status: 400 })
      const { count } = await supabase
        .from("project_tasks")
        .select("*", { count: "exact", head: true })
        .eq("project_id", command.projectId)
      const { data, error } = await supabase
        .from("project_tasks")
        .insert({
          project_id: command.projectId,
          title:      command.taskTitle ?? command.rawTranscript,
          status:     "todo",
          sort_order: count ?? 0,
        })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, data, message: command.humanReadable })
    }

    // ── Update project status ───────────────────────────────────────────────
    case "update_status": {
      if (!command.projectId) return NextResponse.json({ error: "No project identified" }, { status: 400 })
      const { error } = await supabase
        .from("projects")
        .update({ status: command.newStatus })
        .eq("id", command.projectId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, message: command.humanReadable })
    }

    // ── Create client ───────────────────────────────────────────────────────
    case "create_client": {
      if (!command.newClientName) return NextResponse.json({ error: "No client name provided" }, { status: 400 })
      const { data, error } = await supabase
        .from("clients")
        .insert({
          workspace_id: wsId,
          name:         command.newClientName,
          phone:        command.newClientPhone  ?? null,
          email:        command.newClientEmail  ?? null,
          company:      command.newClientCompany ?? null,
        })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, data, message: command.humanReadable, redirect: `/clients/${data.id}` })
    }

    // ── Create project ──────────────────────────────────────────────────────
    case "create_project": {
      const title    = command.projectName ?? command.humanReadable
      const clientId = command.clientId ?? null
      const { data, error } = await supabase
        .from("projects")
        .insert({
          workspace_id: wsId,
          client_id:    clientId,
          title,
          status:       "pending",
        })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, data, message: command.humanReadable, redirect: `/projects/${data.id}` })
    }

    // ── Record payment ──────────────────────────────────────────────────────
    case "record_payment": {
      if (!command.projectId)    return NextResponse.json({ error: "No project identified" }, { status: 400 })
      if (!command.paymentAmount) return NextResponse.json({ error: "No payment amount found" }, { status: 400 })

      // Find the most recent unpaid invoice for the project
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, total, status")
        .eq("project_id", command.projectId)
        .in("status", ["issued", "sent", "overdue"])
        .order("created_at", { ascending: false })
        .limit(1)

      if (!invoices || invoices.length === 0) {
        return NextResponse.json({ error: "No outstanding invoice found for this project" }, { status: 404 })
      }

      const invoice = invoices[0]
      const { data: payment, error } = await supabase
        .from("payments")
        .insert({
          invoice_id: invoice.id,
          amount:     command.paymentAmount,
          method:     command.paymentMethod ?? "eft",
          paid_at:    new Date().toISOString(),
        })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Compute new status
      const { data: allPmts } = await supabase.from("payments").select("amount").eq("invoice_id", invoice.id)
      const totalPaid = (allPmts ?? []).reduce((s: number, p: any) => s + p.amount, 0)
      const newStatus = totalPaid >= invoice.total ? "paid" : "issued"
      await supabase.from("invoices").update({ status: newStatus }).eq("id", invoice.id)

      return NextResponse.json({ success: true, data: payment, message: command.humanReadable })
    }

    // ── Create quote ────────────────────────────────────────────────────────
    case "create_quote": {
      const clientId = command.clientId ?? null
      if (!clientId && !command.clientName) {
        return NextResponse.json({ error: "No client identified" }, { status: 400 })
      }

      // Get workspace VAT settings
      const { data: ws } = await supabase.from("workspaces").select("vat_registered, default_vat_rate").single()
      const vatOn   = ws?.vat_registered !== false
      const vatRate = vatOn ? (ws?.default_vat_rate ?? 15) : 0

      const subtotal   = command.quoteAmount ?? 0
      const vatAmount  = vatOn ? Math.round(subtotal * (vatRate / 100) * 100) / 100 : 0
      const total      = subtotal + vatAmount

      // Get doc number
      const { count } = await supabase.from("quotes").select("*", { count: "exact", head: true })
      const docNumber  = `QTE-${String((count ?? 0) + 1).padStart(5, "0")}`

      const { data: quote, error } = await supabase
        .from("quotes")
        .insert({
          workspace_id:    wsId,
          client_id:       clientId,
          status:          "draft",
          project_title:   command.quoteDescription ?? null,
          doc_number:      docNumber,
          subtotal,
          travel_cost:     0,
          discount_amount: 0,
          vat_rate:        vatRate,
          vat_amount:      vatAmount,
          total,
        })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Add a single line item if we have a description + amount
      if (command.quoteDescription && command.quoteAmount) {
        await supabase.from("quote_line_items").insert({
          quote_id:    quote.id,
          title:       command.quoteDescription,
          description: null,
          quantity:    1,
          unit_price:  command.quoteAmount,
          is_taxable:  vatOn,
          sort_order:  0,
        })
      }

      return NextResponse.json({ success: true, data: quote, message: command.humanReadable, redirect: `/quotes/${quote.id}` })
    }

    default:
      return NextResponse.json({ error: "Unknown command" }, { status: 400 })
  }
}
