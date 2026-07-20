export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatZAR, shortDate } from "@/lib/utils"
import Link from "next/link"

export default async function InvoicesPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, clients(name)")
    .order("created_at", { ascending: false })

  const statusColour: Record<string, any> = {
    draft: "muted", issued: "default", sent: "default",
    paid: "success", overdue: "destructive", cancelled: "muted"
  }

  return (
    <DashboardLayout title="Invoices" actions={
      <Link href="/invoices/new"><Button size="sm">New invoice</Button></Link>
    }>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Invoice #</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Issued</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Due</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(invoices ?? []).map(inv => {
                  const isOverdue = inv.status === "issued" && inv.due_date && inv.due_date < today
                  const displayStatus = isOverdue ? "overdue" : inv.status
                  return (
                    <tr key={inv.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium">{inv.doc_number ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{(inv.clients as any)?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{shortDate(inv.created_at)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{shortDate(inv.due_date)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatZAR(inv.total)}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusColour[displayStatus] ?? "muted"}>{displayStatus}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/invoices/${inv.id}`}>
                          <Button size="sm" variant="ghost">View</Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {(invoices ?? []).length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">No invoices yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
