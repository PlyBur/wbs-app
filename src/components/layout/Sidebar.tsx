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

const navItems = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard },
  { label: "Quotes",     href: "/quotes",      icon: FileText },
  { label: "Projects",   href: "/projects",    icon: FolderKanban },
  { label: "Products",   href: "/products",    icon: Package },
  { label: "Services",   href: "/services",    icon: Wrench },
  { label: "Clients",    href: "/clients",     icon: Users },
  { label: "Messages",   href: "/messages",    icon: MessageSquare },
  { label: "Invoices",   href: "/invoices",    icon: Receipt },
  { label: "Calendar",   href: "/calendar",    icon: Calendar,    soon: true },
  { label: "Team",       href: "/team",        icon: UserCog },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  onClose?: () => void
}

export function Sidebar({ collapsed = false, onToggle, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  function handleNavClick() {
    // Close mobile drawer when navigating
    onClose?.()
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-200",
        // On mobile always show full width; on desktop respect collapsed state
        "w-56 md:w-56",
        collapsed && "md:w-16"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-muted/30 shrink-0">
        {(!collapsed) && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-sidebar-accent flex items-center justify-center text-white font-bold text-sm shrink-0">W</div>
            <span className="font-semibold text-sm truncate">Whistle Suite</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-sidebar-accent flex items-center justify-center text-white font-bold text-sm mx-auto">W</div>
        )}
        {/* Desktop collapse toggle */}
        <button
          onClick={onToggle}
          className="hidden md:flex p-1 rounded hover:bg-sidebar-muted/30 transition-colors ml-auto"
        >
          {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {/* Mobile close X */}
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded hover:bg-sidebar-muted/30 transition-colors ml-auto"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map(({ label, href, icon: Icon, soon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-muted/30 hover:text-sidebar-foreground"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className={cn("flex-1", collapsed ? "md:hidden" : "")}>{label}</span>
              {soon && !collapsed && (
                <span className="hidden md:inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-sidebar-muted/40 text-sidebar-foreground/50 font-medium leading-none">
                  Soon
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-muted/30 p-2 space-y-0.5 shrink-0">
        <Link
          href="/settings"
          onClick={handleNavClick}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
            pathname.startsWith("/settings")
              ? "bg-sidebar-accent text-white"
              : "text-sidebar-foreground/70 hover:bg-sidebar-muted/30 hover:text-sidebar-foreground"
          )}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className={cn(collapsed ? "md:hidden" : "")}>Settings</span>
        </Link>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-muted/30 hover:text-sidebar-foreground transition-colors"
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className={cn(collapsed ? "md:hidden" : "")}>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
