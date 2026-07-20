export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatZAR, shortDate } from "@/lib/utils"
import Link from "next/link"

const statusColour: Record<string, any> = {
  draft: "muted", issued: "default", sent: "default",
  paid: "success", overdue: "destructive", cancelled: "muted"
}

export default async function InvoicesPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, clients(name)")
    .order("created_at", { ascending: false })

  return (
    <DashboardLayout title="Invoices" actions={
      <Link href="/invoices/new"><Button size="sm">New invoice</Button></Link>
    }>
      {/* Desktop table */}
      <Card className="hidden sm:block">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(invoices ?? []).map(inv => {
                  const isOverdue = inv.status === "issued" && inv.due_date && inv.due_date < today
                  const displayStatus = isOverdue ? "overdue" : inv.status
                  return (
                    <tr key={inv.id} className="hover:bg-muted/30 cursor-pointer">
                      <td className="px-5 py-3 font-semibold"><Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">{inv.doc_number ?? "—"}</Link></td>
                      <td className="px-5 py-3 text-muted-foreground"><Link href={`/invoices/${inv.id}`} className="block">{(inv.clients as any)?.name ?? "—"}</Link></td>
                      <td className="px-5 py-3 text-muted-foreground"><Link href={`/invoices/${inv.id}`} className="block">{shortDate(inv.created_at)}</Link></td>
                      <td className="px-5 py-3 text-muted-foreground"><Link href={`/invoices/${inv.id}`} className="block">{shortDate(inv.due_date)}</Link></td>
                      <td className="px-5 py-3 text-right font-semibold"><Link href={`/invoices/${inv.id}`} className="block">{formatZAR(inv.total)}</Link></td>
                      <td className="px-5 py-3"><Link href={`/invoices/${inv.id}`} className="block"><Badge variant={statusColour[displayStatus] ?? "muted"}>{displayStatus}</Badge></Link></td>
                    </tr>
                  )
                })}
                {(invoices ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">No invoices yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {(invoices ?? []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No invoices yet</p>
        )}
        {(invoices ?? []).map(inv => {
          const isOverdue = inv.status === "issued" && inv.due_date && inv.due_date < today
          const displayStatus = isOverdue ? "overdue" : inv.status
          return (
            <Link key={inv.id} href={`/invoices/${inv.id}`}>
              <Card className="hover:shadow-sm transition-shadow active:scale-[0.99]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-primary">{inv.doc_number ?? "—"}</p>
                      <p className="text-sm text-muted-foreground truncate">{(inv.clients as any)?.name ?? "—"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{formatZAR(inv.total)}</p>
                      <Badge variant={statusColour[displayStatus] ?? "muted"} className="mt-1">{displayStatus}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Issued {shortDate(inv.created_at)} · Due {shortDate(inv.due_date)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </DashboardLayout>
  )
}
