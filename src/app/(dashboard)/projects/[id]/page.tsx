"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar } from "@/components/ui/avatar"
import { formatZAR, shortDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  CheckCircle2, Circle, Clock, Trash2, Plus,
  MessageSquare, X, Download, CreditCard,
  Receipt, Eye
} from "lucide-react"
import Link from "next/link"

const statusColour: Record<string, any> = { pending: "muted", active: "default", on_hold: "warning", completed: "success" }
const invStatusColour: Record<string, any> = { draft: "muted", issued: "default", sent: "default", paid: "success", overdue: "destructive", cancelled: "muted" }
const taskStatusIcon: Record<string, React.ReactNode> = {
  todo: <Circle className="w-4 h-4 text-muted-foreground" />,
  in_progress: <Clock className="w-4 h-4 text-primary" />,
  done: <CheckCircle2 className="w-4 h-4 text-success" />,
}
const interactionTypes = ["call", "email", "whatsapp", "site_visit", "meeting", "other"]
const interactionLabels: Record<string, string> = {
  call: "📞 Call", email: "✉️ Email", whatsapp: "💬 WhatsApp",
  site_visit: "📍 Site visit", meeting: "🤝 Meeting", other: "📝 Other"
}
const expenseCategories = ["materials", "labour", "equipment", "subcontract", "transport", "software", "other"]

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [project, setProject] = useState<any>(null)
  const [quote, setQuote] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [allPayments, setAllPayments] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [images, setImages] = useState<any[]>([])
  const [interactions, setInteractions] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [workspace, setWorkspace] = useState<any>(null)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])

  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null)
  const [newTask, setNewTask] = useState("")
  const [taskDueDate, setTaskDueDate] = useState("")
  const [taskAssignedTo, setTaskAssignedTo] = useState("")
  const [addingTask, setAddingTask] = useState(false)
  const [showInteractionForm, setShowInteractionForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [recordPaymentFor, setRecordPaymentFor] = useState<any>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "eft", reference: "", notes: "" })
  const [savingPayment, setSavingPayment] = useState(false)

  const [interactionForm, setInteractionForm] = useState({
    interaction_date: new Date().toISOString().split("T")[0],
    type: "call", contact_person: "", summary: "", next_action: "", next_action_date: ""
  })
  const [expenseForm, setExpenseForm] = useState({
    expense_date: new Date().toISOString().split("T")[0],
    category: "materials", description: "", supplier: "", quantity: 1, unit_cost: 0, notes: ""
  })

  const today = new Date().toISOString().split("T")[0]

  async function load() {
    const [{ data: p }, { data: t }, { data: img }, { data: ws }, { data: members }] = await Promise.all([
      supabase.from("projects").select("*, clients(*), quotes(*)").eq("id", id).single(),
      supabase.from("project_tasks").select("*, team_members(name)").eq("project_id", id).order("sort_order"),
      supabase.from("project_images").select("*").eq("project_id", id).order("uploaded_at", { ascending: false }).limit(6),
      supabase.from("workspaces").select("vat_registered").single(),
      supabase.from("team_members").select("id, name").order("name"),
    ])
    setProject(p); setTasks(t ?? []); setImages(img ?? []); setWorkspace(ws); setTeamMembers(members ?? [])

    if (p?.quote_id) {
      const { data: q } = await supabase.from("quotes").select("*").eq("id", p.quote_id).single()
      setQuote(q)
    }

    const { data: invs } = await supabase
      .from("invoices")
      .select("*, invoice_line_items(*)")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
    setInvoices(invs ?? [])

    if (invs && invs.length > 0) {
      const { data: pmts } = await supabase.from("payments").select("*").in("invoice_id", invs.map((i: any) => i.id))
      setAllPayments(pmts ?? [])
    }

    const { data: act } = await supabase
      .from("project_activity")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(20)
    setActivity(act ?? [])

    const [inter, exp] = await Promise.all([
      fetch(`/api/projects/${id}/interactions`).then(r => r.json()),
      fetch(`/api/projects/${id}/expenses`).then(r => r.json()),
    ])
    setInteractions(Array.isArray(inter) ? inter : [])
    setExpenses(Array.isArray(exp) ? exp : [])
  }

  useEffect(() => { load() }, [id])

  const paidFor = (invId: string) => allPayments.filter(p => p.invoice_id === invId).reduce((s, p) => s + p.amount, 0)
  const paymentsFor = (invId: string) => allPayments.filter(p => p.invoice_id === invId)
  const totalPaid = invoices.reduce((s, inv) => s + paidFor(inv.id), 0)
  const totalDue = invoices.reduce((s, inv) => s + Math.max(0, inv.total - paidFor(inv.id)), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (e.quantity ?? 1) * (e.unit_cost ?? 0), 0)

  async function toggleTask(task: any) {
    const newStatus = task.status === "done" ? "todo" : "done"
    await supabase.from("project_tasks").update({ status: newStatus }).eq("id", task.id)
    const updated = tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
    setTasks(updated)
    const pct = updated.length ? Math.round((updated.filter(t => t.status === "done").length / updated.length) * 100) : 0
    await supabase.from("projects").update({ completion_pct: pct }).eq("id", id)
    setProject((p: any) => ({ ...p, completion_pct: pct }))
  }

  async function addTask() {
    if (!newTask.trim()) return
    setAddingTask(true)
    const { data } = await supabase
      .from("project_tasks")
      .insert({
        project_id: id,
        title: newTask,
        status: "todo",
        sort_order: tasks.length,
        due_date: taskDueDate || null,
        assigned_to: taskAssignedTo || null,
      })
      .select("*, team_members(name)")
      .single()
    if (data) setTasks(ts => [...ts, data])
    setNewTask(""); setTaskDueDate(""); setTaskAssignedTo(""); setAddingTask(false)
  }

  async function deleteTask(taskId: string) {
    await supabase.from("project_tasks").delete().eq("id", taskId)
    const updated = tasks.filter(t => t.id !== taskId)
    setTasks(updated)
    const done = updated.filter(t => t.status === "done").length
    const pct = updated.length ? Math.round((done / updated.length) * 100) : 0
    await supabase.from("projects").update({ completion_pct: pct }).eq("id", id)
    setProject((p: any) => ({ ...p, completion_pct: pct }))
  }

  async function generateInvoice(termType?: string) {
    const key = termType ?? "full"
    setGeneratingInvoice(key)
    const res = await fetch(`/api/projects/${id}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termType: termType ?? null }),
    })
    const inv = await res.json()
    if (inv.id) {
      const { data: invs } = await supabase
        .from("invoices").select("*, invoice_line_items(*)")
        .eq("project_id", id).order("created_at", { ascending: false })
      setInvoices(invs ?? [])
    } else {
      alert(inv.error ?? "Failed to generate invoice")
    }
    setGeneratingInvoice(null)
  }

  async function updateStatus(status: string) {
    await supabase.from("projects").update({ status }).eq("id", id)
    setProject((p: any) => ({ ...p, status }))
  }

  async function deleteProject() {
    if (!confirm(`Delete "${project.title}"? This cannot be undone.`)) return
    await fetch(`/api/projects/${id}`, { method: "DELETE" })
    router.refresh()
    router.push("/projects")
  }

  async function deleteInvoice(invId: string) {
    if (!confirm("Delete this invoice? This cannot be undone.")) return
    await fetch(`/api/invoices/${invId}`, { method: "DELETE" })
    setInvoices(invs => invs.filter(i => i.id !== invId))
    setAllPayments(pmts => pmts.filter(p => p.invoice_id !== invId))
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!recordPaymentFor) return
    setSavingPayment(true)
    const res = await fetch(`/api/invoices/${recordPaymentFor.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...paymentForm, amount: parseFloat(paymentForm.amount) }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? "Failed to record payment")
    } else {
      const allInvIds = invoices.map(i => i.id)
      const [{ data: invs }, { data: allPmts }] = await Promise.all([
        supabase.from("invoices").select("*, invoice_line_items(*)").eq("project_id", id).order("created_at", { ascending: false }),
        supabase.from("payments").select("*").in("invoice_id", allInvIds),
      ])
      setInvoices(invs ?? [])
      setAllPayments(allPmts ?? [])
    }
    setSavingPayment(false)
    setRecordPaymentFor(null)
    setPaymentForm({ amount: "", method: "eft", reference: "", notes: "" })
  }

  async function addInteraction() {
    if (!interactionForm.summary.trim()) return
    const res = await fetch(`/api/projects/${id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(interactionForm),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? "Failed to save interaction"); return }
    setInteractions(i => [data, ...i])
    setShowInteractionForm(false)
    setInteractionForm({
      interaction_date: new Date().toISOString().split("T")[0],
      type: "call",
      contact_person: "",
      summary: "",
      next_action: "",
      next_action_date: "",
    })
  }

  async function deleteInteraction(iid: string) {
    await fetch(`/api/projects/${id}/interactions?interactionId=${iid}`, { method: "DELETE" })
    setInteractions(i => i.filter(x => x.id !== iid))
  }

  async function addExpense() {
    if (!expenseForm.description.trim()) return
    const res = await fetch(`/api/projects/${id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expenseForm),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? "Failed to save expense"); return }
    setExpenses(e => [data, ...e])
    setShowExpenseForm(false)
    setExpenseForm({
      expense_date: new Date().toISOString().split("T")[0],
      category: "materials",
      description: "",
      supplier: "",
      quantity: 1,
      unit_cost: 0,
      notes: "",
    })
  }

  async function deleteExpense(eid: string) {
    await fetch(`/api/projects/${id}/expenses?expenseId=${eid}`, { method: "DELETE" })
    setExpenses(e => e.filter(x => x.id !== eid))
  }

  if (!project) {
    return <DashboardLayout title="Project"><p className="text-sm text-muted-foreground">Loading…</p></DashboardLayout>
  }

  const client = project.clients as any
  const pct = project.completion_pct ?? 0

  const hasTerms = quote?.terms_enabled && quote?.terms_deposit_pct
  const termDefs = hasTerms ? [
    { key: "deposit",  label: quote.terms_deposit_label  ?? "Deposit",                    pct: quote.terms_deposit_pct },
    { key: "progress", label: quote.terms_progress_label ?? "Progress payment",            pct: quote.terms_progress_pct },
    { key: "final",    label: quote.terms_final_label    ?? "Final payment on completion", pct: quote.terms_final_pct },
  ].filter((t: any) => t.pct) : []

  return (
    <DashboardLayout
      title={project.title ?? "Project"}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusColour[project.status] ?? "muted"}>{project.status}</Badge>
          <select
            value={project.status}
            onChange={e => updateStatus(e.target.value)}
            className="border border-border rounded-lg px-2 py-1 text-xs bg-card focus:outline-none"
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
          </select>
          <Button size="sm" variant="destructive" onClick={deleteProject}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      }
    >
      <div className="max-w-3xl space-y-5">

        {/* Project overview */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Project details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Client</p>
                <p className="font-medium">{client?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <Badge variant={statusColour[project.status] ?? "muted"}>{project.status}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Created</p>
                <p className="font-medium">{shortDate(project.created_at)}</p>
              </div>
              {project.start_date && (
                <div>
                  <p className="text-muted-foreground text-xs">Start date</p>
                  <p className="font-medium">{shortDate(project.start_date)}</p>
                </div>
              )}
              {project.end_date && (
                <div>
                  <p className="text-muted-foreground text-xs">End date</p>
                  <p className="font-medium">{shortDate(project.end_date)}</p>
                </div>
              )}
              {quote && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Linked quote</p>
                  <Link href={`/quotes/${quote.id}`} className="font-medium text-primary hover:underline text-sm">
                    {quote.doc_number} — {formatZAR(quote.total)}
                  </Link>
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Completion</span><span>{pct}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment milestones */}
        {hasTerms && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Payment milestones</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {termDefs.map((term: any, i: number) => {
                const amount = quote.total * term.pct / 100
                const termInv = invoices.find(inv => inv.term_type === term.key)
                const termPaid = termInv ? paidFor(termInv.id) >= termInv.total * 0.99 : false
                return (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-2">
                      {termPaid
                        ? <CheckCircle2 className="w-4 h-4 text-success" />
                        : <Circle className="w-4 h-4 text-muted-foreground" />}
                      <div>
                        <p className="text-sm font-medium">{term.label}</p>
                        <p className="text-xs text-muted-foreground">{term.pct}% of total</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatZAR(amount)}</p>
                      <p className={`text-xs ${termPaid ? "text-success" : "text-muted-foreground"}`}>
                        {termPaid ? "Paid" : termInv ? "Invoiced" : "Not invoiced"}
                      </p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Invoices */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4" />Invoices
              </CardTitle>
              {hasTerms ? (
                <div className="flex flex-wrap gap-2">
                  {termDefs.map((term: any) => {
                    const exists = invoices.some(i => i.term_type === term.key)
                    if (exists) return null
                    return (
                      <Button
                        key={term.key}
                        size="sm"
                        variant="outline"
                        onClick={() => generateInvoice(term.key)}
                        disabled={!!generatingInvoice}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {generatingInvoice === term.key ? "Generating…" : term.label}
                      </Button>
                    )
                  })}
                  {termDefs.every((t: any) => invoices.some(i => i.term_type === t.key)) && (
                    <p className="text-xs text-success self-center">All term invoices generated</p>
                  )}
                </div>
              ) : (
                <Button size="sm" onClick={() => generateInvoice()} disabled={!!generatingInvoice}>
                  <Plus className="w-3.5 h-3.5" />
                  {generatingInvoice ? "Generating…" : "Generate invoice"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {invoices.length === 0 && (
              <p className="text-sm text-muted-foreground px-5 py-4 text-center">No invoices yet</p>
            )}
            <ul className="divide-y divide-border">
              {invoices.map(inv => {
                const paid = paidFor(inv.id)
                const due = Math.max(0, inv.total - paid)
                const invPmts = paymentsFor(inv.id)
                const matchedTerm = termDefs.find((t: any) => t.key === inv.term_type)
                const isOverdue = inv.status === "issued" && inv.due_date && inv.due_date < today
                const displayStatus = isOverdue ? "overdue" : inv.status
                return (
                  <li key={inv.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-sm">{inv.doc_number}</p>
                          {inv.term_type && (
                            <Badge variant="muted" className="text-xs">
                              {inv.term_label ?? (matchedTerm as any)?.label ?? inv.term_type}
                            </Badge>
                          )}
                          <Badge variant={invStatusColour[displayStatus] ?? "muted"}>{displayStatus}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Issued {shortDate(inv.created_at)} · Due {shortDate(inv.due_date)}
                        </p>
                        {invPmts.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {invPmts.map((p: any) => (
                              <p key={p.id} className="text-xs text-success">
                                {shortDate(p.paid_at)} — {formatZAR(p.amount)} received
                                ({p.method?.toUpperCase()}{p.reference ? ` · ${p.reference}` : ""})
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right space-y-1 shrink-0">
                        <p className="font-bold text-sm">{formatZAR(inv.total)}</p>
                        {due > 0 && <p className="text-xs text-destructive">{formatZAR(due)} outstanding</p>}
                        {due <= 0 && <p className="text-xs text-success">Fully paid</p>}
                        <div className="flex gap-1 justify-end mt-1">
                          <Link href={`/invoices/${inv.id}`} className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded hover:bg-muted transition-colors"><Eye className="w-3 h-3" />View</Link>
                          <Button
                            size="sm" variant="ghost" className="h-7 px-2 text-xs"
                            onClick={() => window.open(`/api/pdf/invoice/${inv.id}`, "_blank")}
                          >
                            <Download className="w-3 h-3" />PDF
                          </Button>
                          {due > 0 && (
                            <Button
                              size="sm" variant="outline" className="h-7 px-2 text-xs"
                              onClick={() => {
                                setRecordPaymentFor(inv)
                                setPaymentForm(f => ({ ...f, amount: String(due.toFixed(2)) }))
                              }}
                            >
                              <CreditCard className="w-3 h-3" />Pay
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 px-2 text-destructive hover:bg-destructive/10"
                            onClick={() => deleteInvoice(inv.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            {invoices.length > 0 && (
              <div className="border-t border-border px-5 py-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total paid</span>
                  <span className="font-semibold text-success">{formatZAR(totalPaid)}</span>
                </div>
                {totalDue > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Still outstanding</span>
                    <span className="font-semibold text-destructive">{formatZAR(totalDue)}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Record payment */}
        {recordPaymentFor && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Record payment — {recordPaymentFor.doc_number}
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setRecordPaymentFor(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={recordPayment} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Amount (ZAR)</label>
                    <Input
                      type="number" step="0.01"
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Method</label>
                    <select
                      value={paymentForm.method}
                      onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none"
                    >
                      <option value="eft">EFT</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Reference</label>
                  <Input
                    value={paymentForm.reference}
                    onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="e.g. bank reference"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={savingPayment}>
                    {savingPayment ? "Saving…" : "Record payment"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setRecordPaymentFor(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Tasks */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Tasks</CardTitle></CardHeader>
          <CardContent className="p-0">
            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground px-5 py-4 text-center">No tasks yet</p>
            )}
            <ul className="divide-y divide-border">
              {tasks.map(task => {
                const taskOverdue = task.due_date && task.due_date < today && task.status !== "done"
                return (
                  <li key={task.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30 group">
                    <button className="mt-0.5 shrink-0" onClick={() => toggleTask(task)}>
                      {taskStatusIcon[task.status] ?? <Circle className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleTask(task)}>
                      <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {task.due_date && (
                          <p className={`text-xs ${taskOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {taskOverdue ? "⚠ Overdue · " : "Due "}{shortDate(task.due_date)}
                          </p>
                        )}
                        {(task.team_members as any)?.name && (
                          <p className="text-xs text-muted-foreground">
                            {task.due_date ? "· " : ""}{(task.team_members as any).name}
                          </p>
                        )}
                      </div>
                    </div>
                    {(task.team_members as any)?.name && (
                      <Avatar name={(task.team_members as any).name} size="sm" />
                    )}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive mt-0.5 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="border-t border-border px-5 py-3 space-y-2">
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTask()}
                placeholder="Add a task…"
                className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
              {newTask.trim() && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={taskDueDate}
                    onChange={e => setTaskDueDate(e.target.value)}
                    className="flex-1 h-7 text-xs"
                  />
                  <select
                    value={taskAssignedTo}
                    onChange={e => setTaskAssignedTo(e.target.value)}
                    className="flex-1 border border-border rounded-lg px-2 py-1 text-xs bg-card focus:outline-none h-7"
                  >
                    <option value="">No assignee</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" onClick={addTask} disabled={addingTask} className="h-7 px-3 text-xs">
                    {addingTask ? "Adding…" : "Add"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Expenses</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowExpenseForm(v => !v)}>
                <Plus className="w-3.5 h-3.5" />Add expense
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {showExpenseForm && (
              <div className="px-5 py-4 border-b border-border space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Date</label>
                    <Input
                      type="date" value={expenseForm.expense_date}
                      onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Category</label>
                    <select
                      value={expenseForm.category}
                      onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none"
                    >
                      {expenseCategories.map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Description *</label>
                  <Input
                    value={expenseForm.description}
                    onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What was this expense for?"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Supplier</label>
                    <Input
                      value={expenseForm.supplier}
                      onChange={e => setExpenseForm(f => ({ ...f, supplier: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Qty</label>
                    <Input
                      type="number" value={expenseForm.quantity}
                      onChange={e => setExpenseForm(f => ({ ...f, quantity: parseFloat(e.target.value) }))}
                      min="1" step="0.01"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Unit cost</label>
                    <Input
                      type="number" value={expenseForm.unit_cost}
                      onChange={e => setExpenseForm(f => ({ ...f, unit_cost: parseFloat(e.target.value) }))}
                      min="0" step="0.01"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addExpense}>Save expense</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {expenses.length === 0 && !showExpenseForm && (
              <p className="text-sm text-muted-foreground px-5 py-4 text-center">No expenses recorded</p>
            )}
            <ul className="divide-y divide-border">
              {expenses.map(exp => (
                <li key={exp.id} className="flex items-start justify-between gap-3 px-5 py-3 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{exp.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {shortDate(exp.expense_date)} · {exp.category}
                      {exp.supplier ? ` · ${exp.supplier}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {formatZAR((exp.quantity ?? 1) * (exp.unit_cost ?? 0))}
                    </span>
                    <button
                      onClick={() => deleteExpense(exp.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {expenses.length > 0 && (
              <div className="border-t border-border px-5 py-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Total expenses</span>
                <span className="font-semibold">{formatZAR(totalExpenses)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client interactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />Interactions
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowInteractionForm(v => !v)}>
                <Plus className="w-3.5 h-3.5" />Log interaction
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {showInteractionForm && (
              <div className="px-5 py-4 border-b border-border space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Date</label>
                    <Input
                      type="date" value={interactionForm.interaction_date}
                      onChange={e => setInteractionForm(f => ({ ...f, interaction_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Type</label>
                    <select
                      value={interactionForm.type}
                      onChange={e => setInteractionForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none"
                    >
                      {interactionTypes.map(t => (
                        <option key={t} value={t}>{interactionLabels[t]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Contact person</label>
                  <Input
                    value={interactionForm.contact_person}
                    onChange={e => setInteractionForm(f => ({ ...f, contact_person: e.target.value }))}
                    placeholder="Who did you speak to?"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Summary *</label>
                  <textarea
                    value={interactionForm.summary}
                    onChange={e => setInteractionForm(f => ({ ...f, summary: e.target.value }))}
                    placeholder="What was discussed?"
                    rows={3}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Next action</label>
                    <Input
                      value={interactionForm.next_action}
                      onChange={e => setInteractionForm(f => ({ ...f, next_action: e.target.value }))}
                      placeholder="What needs to happen next?"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Follow-up date</label>
                    <Input
                      type="date" value={interactionForm.next_action_date}
                      onChange={e => setInteractionForm(f => ({ ...f, next_action_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addInteraction}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowInteractionForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {interactions.length === 0 && !showInteractionForm && (
              <p className="text-sm text-muted-foreground px-5 py-4 text-center">No interactions logged</p>
            )}
            <ul className="divide-y divide-border">
              {interactions.map(int => (
                <li key={int.id} className="px-5 py-3 group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{interactionLabels[int.type] ?? int.type}</span>
                        <span className="text-xs text-muted-foreground">{shortDate(int.interaction_date)}</span>
                        {int.contact_person && (
                          <span className="text-xs text-muted-foreground">· {int.contact_person}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{int.summary}</p>
                      {int.next_action && (
                        <p className="text-xs mt-1.5 text-primary">
                          → {int.next_action}
                          {int.next_action_date ? ` (by ${shortDate(int.next_action_date)})` : ""}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteInteraction(int.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive mt-0.5 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Photos */}
        {images.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Photos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {images.map(img => (
                  <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={img.url}
                      alt={img.caption ?? ""}
                      className="w-full h-28 object-cover rounded-lg hover:opacity-80 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Activity feed */}
        {activity.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Activity</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {activity.map(act => (
                  <li key={act.id} className="px-5 py-3">
                    <p className="text-sm">{act.body}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{shortDate(act.created_at)}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  )
}
