export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { shortDate } from "@/lib/utils"
import Link from "next/link"

const statusColour: Record<string, any> = { pending: "muted", active: "default", on_hold: "warning", completed: "success" }

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from("projects")
    .select("*, clients(name)")
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
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Project</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Created</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(projects ?? []).map(p => (
                  <tr key={p.id} className="hover:bg-muted/30 cursor-pointer">
                    <td className="px-5 py-3 font-semibold"><Link href={`/projects/${p.id}`} className="text-primary hover:underline">{p.title}</Link></td>
                    <td className="px-5 py-3 text-muted-foreground"><Link href={`/projects/${p.id}`} className="block">{(p.clients as any)?.name ?? "—"}</Link></td>
                    <td className="px-5 py-3 text-muted-foreground"><Link href={`/projects/${p.id}`} className="block">{shortDate(p.created_at)}</Link></td>
                    <td className="px-5 py-3"><Link href={`/projects/${p.id}`} className="block"><Badge variant={statusColour[p.status] ?? "muted"}>{p.status}</Badge></Link></td>
                    <td className="px-5 py-3"><Link href={`/projects/${p.id}`} className="block">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${p.completion_pct ?? 0}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{p.completion_pct ?? 0}%</span>
                      </div>
                    </Link></td>
                  </tr>
                ))}
                {(projects ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">No projects yet</td></tr>
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
        {(projects ?? []).map(p => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="hover:shadow-sm transition-shadow active:scale-[0.99]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-primary truncate">{p.title}</p>
                    <p className="text-sm text-muted-foreground">{(p.clients as any)?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{shortDate(p.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={statusColour[p.status] ?? "muted"}>{p.status}</Badge>
                    <p className="text-xs text-muted-foreground mt-2">{p.completion_pct ?? 0}% done</p>
                  </div>
                </div>
                <div className="mt-3 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${p.completion_pct ?? 0}%` }} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </DashboardLayout>
  )
}
