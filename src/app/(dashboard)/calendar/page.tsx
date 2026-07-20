import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Calendar as CalIcon, Clock, MapPin } from "lucide-react"
import { shortDate } from "@/lib/utils"

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const today = new Date().toISOString().split("T")[0]
  const { data: events } = await supabase
    .from("calendar_events")
    .select("*, team_members(name)")
    .gte("start_at", today)
    .order("start_at")
    .limit(50)

  return (
    <DashboardLayout
      title="Calendar"
      user={{ email: user?.email, name: user?.user_metadata?.full_name }}
      actions={
        <button className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          + New event
        </button>
      }
    >
      {!events || events.length === 0 ? (
        <EmptyState icon={CalIcon} title="No upcoming events" description="Schedule events, site visits, and appointments here." />
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <Card key={ev.id}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="text-center min-w-[48px]">
                  <p className="text-xs text-muted-foreground uppercase">{new Date(ev.start_at).toLocaleString("en-ZA", { month: "short" })}</p>
                  <p className="text-2xl font-bold leading-none">{new Date(ev.start_at).getDate()}</p>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm">{ev.title}</p>
                    <Badge variant="muted">{ev.event_type?.replace("_", " ") ?? "event"}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(ev.start_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</span>
                    {ev.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</span>}
                  </div>
                  {ev.description && <p className="text-xs text-muted-foreground line-clamp-1">{ev.description}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
