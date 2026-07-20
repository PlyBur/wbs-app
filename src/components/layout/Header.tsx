"use client"

import { Bell, Menu } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"

interface HeaderProps {
  title: string
  user?: { email?: string; name?: string; avatarUrl?: string } | null
  actions?: React.ReactNode
  onMenuClick?: () => void
}

export function Header({ title, user, actions, onMenuClick }: HeaderProps) {
  const displayName = user?.name ?? user?.email?.split("@")[0] ?? "User"
  return (
    <header className="h-14 border-b border-border bg-card flex items-center gap-3 px-4 md:px-5 shrink-0">
      {/* Hamburger — mobile only */}
      <button
        className="md:hidden p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-muted-foreground" />
      </button>

      <h1 className="font-semibold text-base flex-1 truncate">{title}</h1>

      {actions && (
        <div className="flex items-center gap-2 flex-wrap justify-end">{actions}</div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors hidden sm:block">
          <Bell className="w-4 h-4 text-muted-foreground" />
        </button>
        <Avatar name={displayName} imageUrl={user?.avatarUrl} size="sm" />
      </div>
    </header>
  )
}
