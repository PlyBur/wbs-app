import { Card, CardContent } from "./card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  deltaType?: "up" | "down" | "neutral"
  icon?: LucideIcon
  iconColour?: string
}

export function StatCard({ label, value, delta, deltaType = "neutral", icon: Icon, iconColour }: StatCardProps) {
  const deltaColour = deltaType === "up" ? "text-success" : deltaType === "down" ? "text-destructive" : "text-muted-foreground"
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {delta && <p className={cn("text-xs font-medium", deltaColour)}>{delta}</p>}
          </div>
          {Icon && (
            <div className={cn("p-2 rounded-lg", iconColour ?? "bg-primary/10")}>
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
