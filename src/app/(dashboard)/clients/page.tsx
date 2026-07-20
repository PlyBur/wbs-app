import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { EmptyState } from "@/components/ui/empty-state"
import { Users, Mail, Phone, Building2 } from "lucide-react"
import Link from "next/link"

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: clients } = await supabase.from("clients").select("*").order("name")

  return (
    <DashboardLayout
      title="Clients"
      user={{ email: user?.email, name: user?.user_metadata?.full_name }}
      actions={
        <Link href="/clients/new" className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          + New client
        </Link>
      }
    >
      {!clients || clients.length === 0 ? (
        <EmptyState icon={Users} title="No clients yet" description="Add your first client to get started." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(c => (
            <Link key={c.id} href={`/clients/${c.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={c.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      {c.company && <p className="text-xs text-muted-foreground truncate">{c.company}</p>}
                    </div>
                    <Badge variant={c.client_type === "business" ? "default" : "secondary"}>{c.client_type}</Badge>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {c.email && <div className="flex items-center gap-2"><Mail className="w-3 h-3" />{c.email}</div>}
                    {c.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" />{c.phone}</div>}
                    {c.address_city && <div className="flex items-center gap-2"><Building2 className="w-3 h-3" />{c.address_city}</div>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
