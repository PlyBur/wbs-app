import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { EmptyState } from "@/components/ui/empty-state"
import { MessageSquare, Mic } from "lucide-react"
import { relativeTime } from "@/lib/utils"

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: messages } = await supabase
    .from("whatsapp_messages")
    .select("*, clients(name)")
    .order("received_at", { ascending: false })
    .limit(50)

  return (
    <DashboardLayout
      title="Messages"
      user={{ email: user?.email, name: user?.user_metadata?.full_name }}
    >
      {!messages || messages.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description="WhatsApp messages from clients will appear here once the integration is configured."
        />
      ) : (
        <div className="max-w-2xl space-y-2">
          {messages.map(msg => {
            const clientName = (msg.clients as any)?.name ?? msg.from_number ?? "Unknown"
            return (
              <Card key={msg.id} className={msg.direction === "inbound" ? "" : "ml-8 bg-primary/5"}>
                <CardContent className="p-4 flex items-start gap-3">
                  <Avatar name={clientName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium">{clientName}</p>
                      <div className="flex items-center gap-2">
                        {msg.message_type === "audio" && <Mic className="w-3 h-3 text-muted-foreground" />}
                        <span className="text-xs text-muted-foreground">{relativeTime(msg.received_at)}</span>
                        <Badge variant={msg.direction === "inbound" ? "secondary" : "default"} >
                          {msg.direction}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{msg.body ?? msg.transcription ?? "—"}</p>
                    {msg.message_type === "audio" && msg.transcription && (
                      <p className="text-xs text-muted-foreground mt-1 italic">Transcribed from voice note</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )
}
