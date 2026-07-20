"use client"

import { Bell, Search } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"

interface HeaderProps {
  title: string
  user?: { email?: string; name?: string; avatarUrl?: string } | null
  actions?: React.ReactNode
}

export function Header({ title, user, actions }: HeaderProps) {
  const displayName = user?.name ?? user?.email?.split("@")[0] ?? "User"
  return (
    <header className="h-14 border-b border-border bg-card flex items-center gap-4 px-5">
      <h1 className="font-semibold text-base flex-1 truncate">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
      <div className="flex items-center gap-3 ml-auto">
        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
        </button>
        <Avatar name={displayName} imageUrl={user?.avatarUrl} size="sm" />
      </div>
    </header>
  )
}
