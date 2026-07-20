"use client"

import { useState } from "react"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
  actions?: React.ReactNode
  user?: { email?: string; name?: string; avatarUrl?: string } | null
}

export function DashboardLayout({ children, title, actions, user }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title={title} user={user} actions={actions} />
        <main className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  )
}
