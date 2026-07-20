export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
      <Card>
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
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(projects ?? []).map(p => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">{p.title}</td>
                    <td className="px-5 py-3 text-muted-foreground">{(p.clients as any)?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{shortDate(p.created_at)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusColour[p.status] ?? "muted"}>{p.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${p.completion_pct ?? 0}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{p.completion_pct ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/projects/${p.id}`}>
                        <Button size="sm" variant="ghost">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {(projects ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">No projects yet — convert an accepted quote to start one</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
