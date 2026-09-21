"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { ThemeToggle } from "@/components/theme-provider"
import { DashboardSidebar } from "@/components/DashboardPage"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export function DashboardFrame({
  actions,
  children,
  title,
}: {
  actions?: ReactNode
  children: ReactNode
  title: string
}) {
  const pathname = usePathname()

  return (
    <SidebarProvider className="dashboard-shell">
      <DashboardSidebar className="no-print" pathname={pathname} />
      <SidebarInset className="dashboard-inset">
        <header className="dashboard-topbar no-print">
          <div className="dashboard-topbar-heading">
            <SidebarTrigger className="dashboard-menu-trigger" />
            <div>
              <span className="dashboard-eyebrow">Workspace</span>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="dashboard-frame-actions">
            {actions}
            <ThemeToggle />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
