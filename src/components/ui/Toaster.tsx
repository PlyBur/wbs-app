"use client"

import { useEffect, useState } from "react"
import { subscribeToasts, type ToastItem } from "@/lib/toast"
import { CheckCircle2, XCircle, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

const icons = {
  success: <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />,
  error:   <XCircle     className="w-4 h-4 text-destructive shrink-0 mt-0.5" />,
  info:    <Info        className="w-4 h-4 text-primary shrink-0 mt-0.5" />,
}
const styles = {
  success: "border-success/30 bg-success/10 text-success",
  error:   "border-destructive/30 bg-destructive/10 text-destructive",
  info:    "border-primary/30 bg-primary/10 text-primary",
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => subscribeToasts(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2.5rem)]">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm",
            "animate-in slide-in-from-bottom-2 fade-in duration-200",
            styles[t.variant]
          )}
        >
          {icons[t.variant]}
          <p className="flex-1 leading-snug">{t.message}</p>
        </div>
      ))}
    </div>
  )
}
