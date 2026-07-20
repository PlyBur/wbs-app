"use client"

import { useState } from "react"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { Toaster } from "@/components/ui/Toaster"

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
  actions?: React.ReactNode
  user?: { email?: string; name?: string; avatarUrl?: string } | null
}

export function DashboardLayout({ children, title, actions, user }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, static on desktop */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 flex md:relative md:z-auto md:translate-x-0 transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header
          title={title}
          user={user}
          actions={actions}
          onMenuClick={() => setMobileOpen(o => !o)}
        />
        {/* Mobile action strip — shown only on small screens when actions exist */}
        {actions && (
          <div className="sm:hidden flex items-center gap-2 px-4 py-2 border-b border-border bg-card overflow-x-auto scrollbar-none shrink-0">
            {actions}
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-4 md:p-5 scrollbar-thin">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  )
}
