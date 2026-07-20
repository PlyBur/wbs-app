import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatZAR, shortDate } from "@/lib/utils"
import { AlertTriangle, Clock, Bell, CheckCircle2, Activity, TrendingUp, Wallet, BarChart3 } from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const today = now.toISOString().split("T")[0]
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const [
    quotesRes, invoicesRes, paymentsRes, activeProjectsRes,
    openProjectCountRes, followUpsRes, activityRes,
  ] = await Promise.all([
    supabase.from("quotes").select("id, doc_number, status, total, expires_at, project_title, clients(name)"),
    supabase.from("invoices").select("id, doc_number, status, total, due_date, clients(name)"),
    supabase.from("payments").select("amount, paid_at, invoice_id"),
    supabase.from("projects").select("id, title, status, due_date, completion_pct, clients(name)").eq("status", "active").order("due_date").limit(8),
    supabase.from("projects").select("id").in("status", ["pending", "active", "on_hold"]),
    supabase.from("project_interactions").select("id, next_action, next_action_date, projects(id, title)").not("next_action", "is", null).lte("next_action_date", today).order("next_action_date").limit(5),
    supabase.from("project_activity").select("id, body, created_at, activity_type, projects(id, title)").order("created_at", { ascending: false }).limit(12),
  ])

  const allQuotes        = quotesRes.data ?? []
  const allInvoices      = invoicesRes.data ?? []
  const allPayments      = paymentsRes.data ?? []
  const activeProjects   = activeProjectsRes.data ?? []
  const openProjectCount = openProjectCountRes.data?.length ?? 0
  const overdueFollowUps = followUpsRes.data ?? []
  const recentActivity   = activityRes.data ?? []

  const paidPerInvoice = allPayments.reduce<Record<string, number>>((acc, p) => {
    acc[p.invoice_id] = (acc[p.invoice_id] ?? 0) + p.amount; return acc
  }, {})

  const revenueThisMonth = allPayments.filter(p => p.paid_at >= startOfMonth).reduce((s, p) => s + p.amount, 0)
  const issuedInvoices   = allInvoices.filter(i => i.status === "issued" || i.status === "sent")
  const outstanding      = issuedInvoices.reduce((s, inv) => s + Math.max(0, inv.total - (paidPerInvoice[inv.id] ?? 0)), 0)
  const openQuotes       = allQuotes.filter(q => q.status === "draft" || q.status === "sent")
  const pipeline         = openQuotes.reduce((s, q) => s + (q.total ?? 0), 0)

  type OverdueInv = typeof allInvoices[0] & { overdueDays: number; amountDue: number }
  const overdueInvoices: OverdueInv[] = issuedInvoices
    .filter(i => i.due_date && i.due_date < today)
    .map(i => ({ ...i, overdueDays: Math.floor((now.getTime() - new Date(i.due_date!).getTime()) / 86400000), amountDue: Math.max(0, i.total - (paidPerInvoice[i.id] ?? 0)) }))
  const overdueAmount = overdueInvoices.reduce((s, i) => s + i.amountDue, 0)

  const sentQuotes     = allQuotes.filter(q => q.status === "sent")
  const acceptedQuotes = allQuotes.filter(q => q.status === "accepted")
  const issuedInvs     = allInvoices.filter(i => i.status === "issued" || i.status === "sent")

  const funnelStages = [
    { label: "Quotes sent",     count: sentQuotes.length,     value: sentQuotes.reduce((s,q)=>s+(q.total??0),0),     bg:"bg-blue-50 dark:bg-blue-950/30",    border:"border-blue-200 dark:border-blue-800",    text:"text-blue-700 dark:text-blue-300",    dot:"bg-blue-500" },
    { label: "Accepted",        count: acceptedQuotes.length, value: acceptedQuotes.reduce((s,q)=>s+(q.total??0),0), bg:"bg-violet-50 dark:bg-violet-950/30", border:"border-violet-200 dark:border-violet-800", text:"text-violet-700 dark:text-violet-300", dot:"bg-violet-500" },
    { label: "Active projects", count: openProjectCount,      value: null,                                            bg:"bg-indigo-50 dark:bg-indigo-950/30", border:"border-indigo-200 dark:border-indigo-800", text:"text-indigo-700 dark:text-indigo-300", dot:"bg-indigo-500" },
    { label: "Invoices issued", count: issuedInvs.length,     value: issuedInvs.reduce((s,i)=>s+(i.total??0),0),    bg:"bg-orange-50 dark:bg-orange-950/30", border:"border-orange-200 dark:border-orange-800", text:"text-orange-700 dark:text-orange-300", dot:"bg-orange-400" },
    { label: "Paid this month", count: null,                  value: revenueThisMonth,                               bg:"bg-emerald-50 dark:bg-emerald-950/30",border:"border-emerald-200 dark:border-emerald-800",text:"text-emerald-700 dark:text-emerald-300",dot:"bg-emerald-500" },
  ]

  const expiringQuotes = allQuotes.filter(q => q.status==="sent" && q.expires_at && q.expires_at.split("T")[0]>=today && q.expires_at.split("T")[0]<=in7Days).sort((a,b)=>(a.expires_at??"").localeCompare(b.expires_at??""))
  const hasActionItems = overdueInvoices.length > 0 || expiringQuotes.length > 0 || overdueFollowUps.length > 0

  return (
    <DashboardLayout title="Dashboard" user={{ email: user?.email, name: user?.user_metadata?.full_name }}>
      {/* Financial Pulse */}
      <div className="grid grid-cols-2 lg:grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-5">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-600" /><p className="text-xs text-muted-foreground">Revenue this month</p></div>
            <p className="text-base sm:text-2xl font-bold text-emerald-600 truncate">{formatZAR(revenueThisMonth)}</p>
            <p className="text-xs text-muted-foreground mt-1">Payments received</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1"><Wallet className="w-3.5 h-3.5 text-primary" /><p className="text-xs text-muted-foreground">Outstanding</p></div>
            <p className="text-base sm:text-2xl font-bold truncate">{formatZAR(outstanding)}</p>
            <p className="text-xs text-muted-foreground mt-1">{issuedInvoices.length} issued invoice{issuedInvoices.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1"><BarChart3 className="w-3.5 h-3.5 text-blue-500" /><p className="text-xs text-muted-foreground">Quote pipeline</p></div>
            <p className="text-base sm:text-2xl font-bold truncate">{formatZAR(pipeline)}</p>
            <p className="text-xs text-muted-foreground mt-1">{openQuotes.length} open quote{openQuotes.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${overdueAmount > 0 ? "border-l-destructive" : "border-l-muted"}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className={`w-3.5 h-3.5 ${overdueAmount > 0 ? "text-destructive" : "text-muted-foreground"}`} /><p className="text-xs text-muted-foreground">Overdue</p></div>
            <p className={`text-base sm:text-2xl font-bold truncate ${overdueAmount > 0 ? "text-destructive" : ""}`}>{formatZAR(overdueAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">{overdueInvoices.length} invoice{overdueInvoices.length !== 1 ? "s" : ""} past due</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Funnel */}
      <Card className="mb-5">
        <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Sales pipeline</CardTitle></CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-stretch gap-1 overflow-x-auto">
            {funnelStages.map((stage, i) => (
              <div key={i} className="flex items-center flex-1 min-w-[110px]">
                <div className={`flex-1 rounded-lg border p-3 ${stage.bg} ${stage.border}`}>
                  <div className={`w-2 h-2 rounded-full ${stage.dot} mb-2`} />
                  <p className={`text-xs font-medium leading-tight ${stage.text}`}>{stage.label}</p>
                  {stage.count !== null && <p className={`text-2xl font-bold mt-1 ${stage.text}`}>{stage.count}</p>}
                  {stage.value !== null && <p className={`text-xs font-semibold mt-0.5 ${stage.text}`}>{formatZAR(stage.value)}</p>}
                </div>
                {i < funnelStages.length - 1 && (
                  <svg className="w-4 h-4 text-muted-foreground/30 mx-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M6 3l5 5-5 5V3z" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-5">
        {/* Action Items */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold px-0.5">Action items</h2>
          {!hasActionItems && (
            <Card><CardContent className="py-10 text-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2.5" />
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs text-muted-foreground mt-1">No outstanding action items</p>
            </CardContent></Card>
          )}
          {overdueInvoices.length > 0 && (
            <Card className="border-destructive/40">
              <CardHeader className="pb-2 pt-3"><CardTitle className="text-xs font-semibold text-destructive flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Overdue invoices ({overdueInvoices.length})</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-0.5">
                {overdueInvoices.slice(0, 4).map(inv => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between text-xs hover:bg-muted/50 -mx-1 px-1 py-1.5 rounded transition-colors">
                    <div><span className="font-medium">{(inv.clients as any)?.name ?? "Unknown"}</span><span className="text-muted-foreground"> · {inv.overdueDays}d overdue</span></div>
                    <span className="font-semibold text-destructive">{formatZAR(inv.amountDue)}</span>
                  </Link>
                ))}
                {overdueInvoices.length > 4 && <Link href="/invoices" className="block text-xs text-primary hover:underline pt-1.5">+{overdueInvoices.length - 4} more →</Link>}
              </CardContent>
            </Card>
          )}
          {expiringQuotes.length > 0 && (
            <Card className="border-amber-300/60">
              <CardHeader className="pb-2 pt-3"><CardTitle className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Expiring quotes — next 7 days ({expiringQuotes.length})</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-0.5">
                {expiringQuotes.map(q => (
                  <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between text-xs hover:bg-muted/50 -mx-1 px-1 py-1.5 rounded transition-colors">
                    <div><span className="font-medium">{q.doc_number}</span>{q.project_title && <span className="text-muted-foreground"> · {q.project_title}</span>}</div>
                    <div className="text-right"><p className="font-semibold">{formatZAR(q.total ?? 0)}</p><p className="text-muted-foreground">Expires {shortDate(q.expires_at)}</p></div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
          {overdueFollowUps.length > 0 && (
            <Card className="border-orange-300/60">
              <CardHeader className="pb-2 pt-3"><CardTitle className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" />Follow-ups due ({overdueFollowUps.length})</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-0.5">
                {overdueFollowUps.map((f: any) => (
                  <Link key={f.id} href={`/projects/${f.projects?.id}`} className="flex items-start justify-between text-xs hover:bg-muted/50 -mx-1 px-1 py-1.5 rounded transition-colors">
                    <div className="min-w-0 mr-3"><span className="font-medium">{f.projects?.title ?? "Project"}</span><p className="text-muted-foreground truncate max-w-[220px]">{f.next_action}</p></div>
                    <span className="text-orange-600 dark:text-orange-400 shrink-0">{shortDate(f.next_action_date)}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Active Projects */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm font-semibold">Active projects</h2>
            <Link href="/projects" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <Card>
            <CardContent className="p-0">
              {activeProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No active projects</p>
              ) : (
                <ul className="divide-y divide-border">
                  {activeProjects.map(p => {
                    const isOverdueProject = p.due_date && p.due_date < today
                    const isUrgent = p.due_date && !isOverdueProject && p.due_date <= in7Days
                    const dueCls = isOverdueProject ? "text-destructive" : isUrgent ? "text-amber-500" : "text-muted-foreground"
                    return (
                      <li key={p.id}>
                        <Link href={`/projects/${p.id}`} className="block px-5 py-3.5 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0"><p className="text-sm font-medium truncate">{p.title}</p><p className="text-xs text-muted-foreground">{(p.clients as any)?.name ?? "—"}</p></div>
                            {p.due_date && <p className={`text-xs shrink-0 font-medium ${dueCls}`}>{isOverdueProject ? "Overdue" : `Due ${shortDate(p.due_date)}`}</p>}
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${p.completion_pct ?? 0}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{p.completion_pct ?? 0}%</span>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Recent activity</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {recentActivity.map(log => (
                <li key={log.id}>
                  <Link href={`/projects/${(log.projects as any)?.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/50 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{log.body}</p>
                      {(log.projects as any)?.title && <p className="text-xs text-muted-foreground">{(log.projects as any).title}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{shortDate(log.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  )
}
