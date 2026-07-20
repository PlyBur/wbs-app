import { createClient } from "./server"
import type { Quote, Project, Invoice, Client, Product, Service, TeamMember } from "@/types"

// ── Workspace ───────────────────────────────────────────────
export async function getWorkspace() {
  const supabase = await createClient()
  const { data } = await supabase.from("workspaces").select("*").single()
  return data
}

// ── Clients ─────────────────────────────────────────────────
export async function getClients(): Promise<Client[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("clients").select("*").order("name")
  return data ?? []
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = await createClient()
  const { data } = await supabase.from("clients").select("*").eq("id", id).single()
  return data
}

// ── Products ─────────────────────────────────────────────────
export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("products").select("*").order("name")
  return data ?? []
}

// ── Services ─────────────────────────────────────────────────
export async function getServices(): Promise<Service[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("services").select("*").order("name")
  return data ?? []
}

// ── Quotes ───────────────────────────────────────────────────
export async function getQuotes() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("quotes")
    .select("*, clients(name, company)")
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function getQuote(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("quotes")
    .select("*, clients(*), quote_line_items(*)")
    .eq("id", id)
    .single()
  return data
}

// ── Projects ─────────────────────────────────────────────────
export async function getProjects() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("projects")
    .select("*, clients(name, company)")
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function getProject(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("projects")
    .select("*, clients(*), project_tasks(*, team_members(name)), project_images(*), project_activity(*, team_members(name))")
    .eq("id", id)
    .single()
  return data
}

// ── Invoices ─────────────────────────────────────────────────
export async function getInvoices() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("invoices")
    .select("*, clients(name, company)")
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function getInvoice(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("invoices")
    .select("*, clients(*), invoice_line_items(*), payments(*)")
    .eq("id", id)
    .single()
  return data
}

// ── Team ─────────────────────────────────────────────────────
export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("team_members").select("*").order("name")
  return data ?? []
}

// ── Dashboard stats ───────────────────────────────────────────
export async function getDashboardStats() {
  const supabase = await createClient()
  const [activeQuotes, activeProjects, overdueInvoices, clients] = await Promise.all([
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("status", "sent"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "overdue"),
    supabase.from("clients").select("id", { count: "exact", head: true }),
  ])
  return {
    activeQuotes: activeQuotes.count ?? 0,
    activeProjects: activeProjects.count ?? 0,
    overdueInvoices: overdueInvoices.count ?? 0,
    totalClients: clients.count ?? 0,
  }
}
