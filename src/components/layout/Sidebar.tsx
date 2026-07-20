"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, FileText, FolderKanban, Package, Wrench,
  Users, MessageSquare, Receipt, Calendar, UserCog, Settings,
  LogOut, ChevronLeft, Menu
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"

const navItems = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard },
  { label: "Quotes",     href: "/quotes",      icon: FileText },
  { label: "Projects",   href: "/projects",    icon: FolderKanban },
  { label: "Products",   href: "/products",    icon: Package },
  { label: "Services",   href: "/services",    icon: Wrench },
  { label: "Clients",    href: "/clients",     icon: Users },
  { label: "Messages",   href: "/messages",    icon: MessageSquare },
  { label: "Invoices",   href: "/invoices",    icon: Receipt },
  { label: "Calendar",   href: "/calendar",    icon: Calendar },
  { label: "Team",       href: "/team",        icon: UserCog },
]

interface SidebarProps { collapsed?: boolean; onToggle?: () => void }

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-muted/30">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-sidebar-accent flex items-center justify-center text-white font-bold text-sm shrink-0">W</div>
            <span className="font-semibold text-sm truncate">Whistle Suite</span>
          </div>
        )}
        {collapsed && <div className="w-7 h-7 rounded-lg bg-sidebar-accent flex items-center justify-center text-white font-bold text-sm mx-auto">W</div>}
        <button onClick={onToggle} className="p-1 rounded hover:bg-sidebar-muted/30 transition-colors ml-auto">
          {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-muted/30 hover:text-sidebar-foreground"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-muted/30 p-2 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname.startsWith("/settings")
              ? "bg-sidebar-accent text-white"
              : "text-sidebar-foreground/70 hover:bg-sidebar-muted/30 hover:text-sidebar-foreground"
          )}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-muted/30 hover:text-sidebar-foreground transition-colors"
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}
