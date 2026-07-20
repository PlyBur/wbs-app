export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatZAR, shortDate } from "@/lib/utils"
import Link from "next/link"

const statusBadge: Record<string, any> = { pending: "muted", active: "default", on_hold: "warning", completed: "success" }

// Left-border stripe colour per status
const statusStripe: Record<string, string> = {
  pending:   "bg-amber-400",
  active:    "bg-blue-500",
  on_hold:   "bg-orange-400",
  completed: "bg-emerald-500",
}

// Subtle row tint per status
const statusRowBg: Record<string, string> = {
  pending:   "hover:bg-amber-50/60",
  active:    "hover:bg-blue-50/60",
  on_hold:   "hover:bg-orange-50/60",
  completed: "hover:bg-emerald-50/60",
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from("projects")
    .select("*, clients(name), quotes(total)")
    .order("created_at", { ascending: false })

  return (
    <DashboardLayout title="Projects">
      {/* Desktop table */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-1 p-0" />
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Project</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Created</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Value</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(projects ?? []).map(p => {
                  const quoteTotal = (p.quotes as any)?.total ?? null
                  return (
                    <tr key={p.id} className={`cursor-pointer transition-colors ${statusRowBg[p.status] ?? "hover:bg-muted/30"}`}>
                      {/* Status stripe */}
                      <td className={`w-1 p-0 ${statusStripe[p.status] ?? "bg-muted"}`} />
                      <td className="px-5 py-3 font-semibold">
                        <Link href={`/projects/${p.id}`} className="text-primary hover:underline">{p.title}</Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <Link href={`/projects/${p.id}`} className="block">{(p.clients as any)?.name ?? "—"}</Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <Link href={`/projects/${p.id}`} className="block">{shortDate(p.created_at)}</Link>
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/projects/${p.id}`} className="block">
                          <Badge variant={statusBadge[p.status] ?? "muted"}>{p.status}</Badge>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">
                        <Link href={`/projects/${p.id}`} className="block">
                          {quoteTotal != null ? formatZAR(quoteTotal) : <span className="text-muted-foreground font-normal">—</span>}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/projects/${p.id}`} className="block">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${p.completion_pct ?? 0}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{p.completion_pct ?? 0}%</span>
                          </div>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {(projects ?? []).length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">No projects yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {(projects ?? []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No projects yet — convert an accepted quote to start one</p>
        )}
        {(projects ?? []).map(p => {
          const quoteTotal = (p.quotes as any)?.total ?? null
          return (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className={`hover:shadow-sm transition-shadow active:scale-[0.99] border-l-4 ${
                p.status === "active"    ? "border-l-blue-500" :
                p.status === "completed" ? "border-l-emerald-500" :
                p.status === "on_hold"   ? "border-l-orange-400" :
                                           "border-l-amber-400"
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-primary truncate">{p.title}</p>
                      <p className="text-sm text-muted-foreground">{(p.clients as any)?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{shortDate(p.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={statusBadge[p.status] ?? "muted"}>{p.status}</Badge>
                      {quoteTotal != null && (
                        <p className="text-sm font-semibold mt-1">{formatZAR(quoteTotal)}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{p.completion_pct ?? 0}% done</p>
                    </div>
                  </div>
                  <div className="mt-3 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${p.completion_pct ?? 0}%` }} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </DashboardLayout>
  )
}
