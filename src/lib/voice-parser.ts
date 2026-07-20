export interface VoiceProject { id: string; title: string; clientName?: string }

export type CommandAction =
  | "log_interaction"
  | "add_expense"
  | "create_task"
  | "update_status"
  | "unknown"

export interface ParsedCommand {
  action: CommandAction
  projectId?: string
  projectTitle?: string
  // log_interaction
  interactionType?: string
  summary?: string
  // add_expense
  amount?: number
  category?: string
  expenseDescription?: string
  // create_task
  taskTitle?: string
  // update_status
  newStatus?: string
  humanReadable: string
  confidence: "high" | "medium" | "low"
  rawTranscript: string
}

// ── Keyword maps ──────────────────────────────────────────────────────────────

const INTERACTION_KEYWORDS: Record<string, string[]> = {
  site_visit: ["site visit", "visit", "on site", "onsite", "on-site"],
  call:       ["called", "phone call", "phoned", "spoke on the phone", "rang"],
  email:      ["email", "emailed", "sent an email"],
  whatsapp:   ["whatsapp", "whats app", "voice note", "watsapp"],
  meeting:    ["meeting", "met with", "sat down", "meeting with"],
  other:      ["note", "noted", "update", "log", "record"],
}

const EXPENSE_KEYWORDS: Record<string, string[]> = {
  materials:    ["material", "materials", "cement", "tiles", "tile", "brick", "bricks", "steel", "wood", "timber", "plumbing", "electrical", "paint", "sand", "gravel", "aggregate"],
  labour:       ["labour", "labor", "worker", "workers", "staff", "wages", "salary"],
  equipment:    ["equipment", "tool", "tools", "hire", "hired", "rental", "rented"],
  subcontract:  ["subcontract", "sub-contract", "outsource", "contractor", "plumber", "electrician"],
  transport:    ["transport", "petrol", "fuel", "delivery", "delivered", "courier", "vehicle"],
  other:        [],
}

const STATUS_KEYWORDS: Record<string, string[]> = {
  active:    ["active", "activate", "start", "started", "in progress", "underway"],
  pending:   ["pending", "waiting", "not started"],
  on_hold:   ["on hold", "hold", "pause", "paused", "stopped", "put on hold"],
  completed: ["complete", "completed", "done", "finished", "finish", "close"],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findProject(text: string, projects: VoiceProject[]): VoiceProject | null {
  const lower = text.toLowerCase()
  // Try full title match first
  const full = projects.find(p => lower.includes(p.title.toLowerCase()))
  if (full) return full
  // Try client name match
  const byClient = projects.find(p => p.clientName && lower.includes(p.clientName.toLowerCase()))
  if (byClient) return byClient
  // Try partial word match (3+ char words)
  for (const p of projects) {
    const words = p.title.toLowerCase().split(/\s+/).filter(w => w.length >= 3)
    if (words.some(w => lower.includes(w))) return p
  }
  return null
}

function extractAmount(text: string): number | null {
  // "R 450", "R450", "450 rand", "four fifty" (numeric only)
  const match =
    text.match(/[Rr]\s*(\d[\d\s]*(?:[.,]\d+)?)/i) ||
    text.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*rand/i)
  if (match) {
    const raw = match[1].replace(/\s/g, "").replace(",", ".")
    const n = parseFloat(raw)
    return isNaN(n) ? null : n
  }
  return null
}

function matchFirst<T extends string>(text: string, map: Record<T, string[]>): T | null {
  const lower = text.toLowerCase()
  for (const [key, keywords] of Object.entries(map) as [T, string[]][]) {
    if (keywords.some(k => lower.includes(k))) return key
  }
  return null
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseVoiceCommand(transcript: string, projects: VoiceProject[]): ParsedCommand {
  const text = transcript.toLowerCase().trim()
  const raw  = transcript

  const project = findProject(text, projects)

  // ── Expense detection ─────────────────────────────────────────────────────
  const looksLikeExpense =
    /\b(add|bought|purchased|expense|spent|cost|paid)\b/.test(text) &&
    extractAmount(text) !== null

  if (looksLikeExpense) {
    const amount   = extractAmount(text)
    const category = matchFirst(text, EXPENSE_KEYWORDS) ?? "other"
    // Strip action words and amount to get description
    const desc = raw
      .replace(/[Rr]\s*\d[\d\s]*(?:[.,]\d+)?/g, "")
      .replace(/\b(add|bought|purchased|expense|spent|cost|paid|an?|the|on|for|in)\b/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim() || raw

    return {
      action: "add_expense",
      projectId: project?.id,
      projectTitle: project?.title,
      amount: amount ?? undefined,
      category,
      expenseDescription: desc,
      humanReadable: project && amount
        ? `Add R${amount.toFixed(2)} ${category} expense on "${project.title}"`
        : `Add R${amount?.toFixed(2) ?? "?"} ${category} expense${project ? ` on "${project.title}"` : " — no project matched"}`,
      confidence: project && amount ? "high" : "medium",
      rawTranscript: raw,
    }
  }

  // ── Status update detection ───────────────────────────────────────────────
  const looksLikeStatus =
    /\b(mark|set|change|update)\b/.test(text) &&
    /\b(active|complete|completed|done|on hold|pending|finish|pause|paused)\b/.test(text)

  if (looksLikeStatus) {
    const newStatus = matchFirst(text, STATUS_KEYWORDS) ?? "active"
    return {
      action: "update_status",
      projectId: project?.id,
      projectTitle: project?.title,
      newStatus,
      humanReadable: project
        ? `Mark "${project.title}" as ${newStatus.replace("_", " ")}`
        : `Update project status to ${newStatus.replace("_", " ")} — no project matched`,
      confidence: project ? "high" : "medium",
      rawTranscript: raw,
    }
  }

  // ── Task detection ────────────────────────────────────────────────────────
  const looksLikeTask =
    /\b(task|todo|to do|to-do|remind|reminder|create task|add task|schedule|need to|must)\b/.test(text)

  if (looksLikeTask) {
    // Pull out the task content — strip project name and action words
    let taskTitle = raw
    if (project) taskTitle = taskTitle.replace(new RegExp(project.title, "gi"), "")
    taskTitle = taskTitle
      .replace(/\b(add|create|make|task|todo|to do|to-do|remind me to|schedule|for|on|the|a|an)\b/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim() || raw

    return {
      action: "create_task",
      projectId: project?.id,
      projectTitle: project?.title,
      taskTitle,
      humanReadable: project
        ? `Create task "${taskTitle}" on "${project.title}"`
        : `Create task "${taskTitle}" — no project matched`,
      confidence: project ? "high" : "medium",
      rawTranscript: raw,
    }
  }

  // ── Interaction detection (catch-all for logging) ─────────────────────────
  const looksLikeInteraction =
    /\b(log|record|note|spoke|called|visited|met|had a|site visit|whatsapp|email|meeting)\b/.test(text)

  if (looksLikeInteraction) {
    const interactionType = matchFirst(text, INTERACTION_KEYWORDS) ?? "other"
    return {
      action: "log_interaction",
      projectId: project?.id,
      projectTitle: project?.title,
      interactionType,
      summary: raw,
      humanReadable: project
        ? `Log ${interactionType.replace("_", " ")} on "${project.title}"`
        : `Log ${interactionType.replace("_", " ")} — no project matched`,
      confidence: project ? "high" : "medium",
      rawTranscript: raw,
    }
  }

  return {
    action: "unknown",
    humanReadable: `Didn't understand: "${raw}"`,
    confidence: "low",
    rawTranscript: raw,
  }
}
