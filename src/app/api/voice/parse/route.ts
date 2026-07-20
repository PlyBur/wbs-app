import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a voice command parser for TradesPro — a business management app used by South African trades contractors (plumbers, electricians, builders, painters, etc.).

The user has just spoken a voice command. Extract the intended action and parameters and return them as valid JSON only — no explanation, no markdown, just the JSON object.

Supported actions:
- log_interaction: Log a client/project interaction (site visit, call, WhatsApp, email, meeting, note)
- add_expense: Add a project expense with amount and category
- create_task: Create a to-do task on a project
- update_status: Change a project's status (active, pending, on_hold, completed)
- create_client: Create a new client with name and optional contact details
- create_project: Create a new project for an existing or new client
- record_payment: Record a payment received against a project's invoice
- create_quote: Create a basic quote for a client
- unknown: Cannot determine intent

Context notes:
- South African context: amounts are in Rand (R). "R450", "four fifty", "450 rand" all mean R450
- Users may mix English and Afrikaans: "die Botha projek" = the Botha project
- Match project/client names loosely — "the Smith job", "Smiths", "Smith kitchen" likely refer to the same project
- Interaction types: site_visit, call, email, whatsapp, meeting, other
- Expense categories: materials, labour, equipment, subcontract, transport, other
- Project statuses: active, pending, on_hold, completed
- If confidence is low or info is missing, still return your best guess with confidence: "low"`

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 })
  }

  const { transcript, projects, clients } = await request.json()
  const today = new Date().toISOString().split("T")[0]

  const userPrompt = `Today: ${today}

Known projects (id, title, client):
${JSON.stringify(projects.map((p: any) => ({ id: p.id, title: p.title, client: p.clientName })))}

Known clients (id, name):
${JSON.stringify(clients.map((c: any) => ({ id: c.id, name: c.name })))}

Voice transcript: "${transcript}"

Return a single JSON object with these fields (use null for anything not applicable):
{
  "action": "log_interaction" | "add_expense" | "create_task" | "update_status" | "create_client" | "create_project" | "record_payment" | "create_quote" | "unknown",
  "projectId": string | null,
  "projectTitle": string | null,
  "clientId": string | null,
  "clientName": string | null,
  "interactionType": "site_visit" | "call" | "email" | "whatsapp" | "meeting" | "other" | null,
  "summary": string | null,
  "amount": number | null,
  "category": "materials" | "labour" | "equipment" | "subcontract" | "transport" | "other" | null,
  "expenseDescription": string | null,
  "taskTitle": string | null,
  "newStatus": "active" | "pending" | "on_hold" | "completed" | null,
  "newClientName": string | null,
  "newClientPhone": string | null,
  "newClientEmail": string | null,
  "newClientCompany": string | null,
  "projectName": string | null,
  "paymentAmount": number | null,
  "paymentMethod": "eft" | "cash" | "card" | "other" | null,
  "quoteDescription": string | null,
  "quoteAmount": number | null,
  "humanReadable": string,
  "confidence": "high" | "medium" | "low"
}`

  try {
    const message = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: userPrompt }],
    })

    const text = message.content[0].type === "text" ? message.content[0].text : ""

    // Extract JSON from the response (strip any accidental markdown fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON in response")

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (err: any) {
    console.error("Anthropic parse error:", err)
    return NextResponse.json({ error: err.message ?? "Parse failed" }, { status: 500 })
  }
}
