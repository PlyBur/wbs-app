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
      <Card>
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
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(quotes ?? []).map(q => (
                  <tr key={q.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">{q.doc_number ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{(q.clients as any)?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{shortDate(q.created_at)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{shortDate(q.expires_at)}</td>
                    <td className="px-5 py-3 text-right font-semibold">{formatZAR(q.total)}</td>
                    <td className="px-5 py-3"><Badge variant={statusColour[q.status] ?? "muted"}>{q.status}</Badge></td>
                    <td className="px-5 py-3">
                      <Link href={`/quotes/${q.id}`}>
                        <Button size="sm" variant="ghost">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {(quotes ?? []).length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">No quotes yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
