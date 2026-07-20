import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Wrench } from "lucide-react"
import { formatZAR } from "@/lib/utils"
import Link from "next/link"

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: services } = await supabase.from("services").select("*").order("name")

  return (
    <DashboardLayout
      title="Services"
      user={{ email: user?.email, name: user?.user_metadata?.full_name }}
      actions={
        <Link href="/services/new" className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          + New service
        </Link>
      }
    >
      {!services || services.length === 0 ? (
        <EmptyState icon={Wrench} title="No services yet" description="Add your billable services to use in quotes." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map(s => (
            <Link key={s.id} href={`/services/${s.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm truncate flex-1">{s.name}</p>
                    <Badge variant={s.pricing_type === "fixed" ? "default" : "secondary"}>{s.pricing_type}</Badge>
                  </div>
                  {s.description && <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                  <p className="text-sm font-bold">{formatZAR(s.default_rate)} <span className="text-xs font-normal text-muted-foreground">/ {s.unit ?? "hr"}</span></p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
