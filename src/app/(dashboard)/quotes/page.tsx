export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatZAR, shortDate } from "@/lib/utils"
import Link from "next/link"

const statusColour: Record<string, any> = { draft: "muted", sent: "default", accepted: "success", declined: "destructive", expired: "warning" }

export default async function QuotesPage() {
  const supabase = await createClient()
  const { data: quotes } = await supabase
    .from("quotes")
    .select("*, clients(name)")
    .order("created_at", { ascending: false })

  return (
    <DashboardLayout title="Quotes" actions={
      <Link href="/quotes/new"><Button size="sm">New quote</Button></Link>
    }>
      {/* Desktop table */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Quote #</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Expires</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(quotes ?? []).map(q => (
                  <tr key={q.id} className="hover:bg-muted/30 cursor-pointer">
                    <td className="px-5 py-3 font-semibold">
                      <Link href={`/quotes/${q.id}`} className="text-primary hover:underline">{q.doc_number ?? "—"}</Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground"><Link href={`/quotes/${q.id}`} className="block">{(q.clients as any)?.name ?? "—"}</Link></td>
                    <td className="px-5 py-3 text-muted-foreground"><Link href={`/quotes/${q.id}`} className="block">{shortDate(q.created_at)}</Link></td>
                    <td className="px-5 py-3 text-muted-foreground"><Link href={`/quotes/${q.id}`} className="block">{shortDate(q.expires_at)}</Link></td>
                    <td className="px-5 py-3 text-right font-semibold"><Link href={`/quotes/${q.id}`} className="block">{formatZAR(q.total)}</Link></td>
                    <td className="px-5 py-3"><Link href={`/quotes/${q.id}`} className="block"><Badge variant={statusColour[q.status] ?? "muted"}>{q.status}</Badge></Link></td>
                  </tr>
                ))}
                {(quotes ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">No quotes yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {(quotes ?? []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No quotes yet</p>
        )}
        {(quotes ?? []).map(q => (
          <Link key={q.id} href={`/quotes/${q.id}`}>
            <Card className="hover:shadow-sm transition-shadow active:scale-[0.99]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-primary">{q.doc_number ?? "—"}</p>
                    <p className="text-sm text-muted-foreground truncate">{(q.clients as any)?.name ?? "—"}</p>
                    {q.project_title && <p className="text-xs text-muted-foreground truncate">{q.project_title}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">{formatZAR(q.total)}</p>
                    <Badge variant={statusColour[q.status] ?? "muted"} className="mt-1">{q.status}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{shortDate(q.created_at)}{q.expires_at ? ` · Expires ${shortDate(q.expires_at)}` : ""}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </DashboardLayout>
  )
}
