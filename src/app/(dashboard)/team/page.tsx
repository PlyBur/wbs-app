import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { EmptyState } from "@/components/ui/empty-state"
import { UserCog, Mail, Phone } from "lucide-react"

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: members } = await supabase.from("team_members").select("*").order("name")

  return (
    <DashboardLayout
      title="Team"
      user={{ email: user?.email, name: user?.user_metadata?.full_name }}
      actions={
        <button className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          + Invite member
        </button>
      }
    >
      {!members || members.length === 0 ? (
        <EmptyState icon={UserCog} title="No team members yet" description="Invite your team to collaborate." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {members.map(m => (
            <Card key={m.id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar name={m.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                  </div>
                  <Badge variant={m.status === "active" ? "success" : m.status === "invited" ? "warning" : "muted"}>
                    {m.status}
                  </Badge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {m.email && <div className="flex items-center gap-2"><Mail className="w-3 h-3" />{m.email}</div>}
                  {m.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" />{m.phone}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
