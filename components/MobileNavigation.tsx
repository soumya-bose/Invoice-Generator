"use client"

import Link from "next/link"
import Image from "next/image"
import { ArchiveIcon, BoxesIcon, FilePlus2Icon } from "lucide-react"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-provider"

const navigationItems = [
  { href: "/", label: "Invoice", icon: FilePlus2Icon },
  { href: "/inventory", label: "Inventory", icon: BoxesIcon },
  { href: "/saved-invoices", label: "Saved invoices", icon: ArchiveIcon },
]

export function MobileNavigation() {
  const pathname = usePathname()

  return (
    <SidebarProvider className="mobile-nav-provider">
      <SidebarTrigger
        className="mobile-nav-trigger"
        aria-label="Open navigation"
      />
      <Sidebar
        className="mobile-nav-sidebar"
        side="left"
        collapsible="offcanvas"
      >
        <SidebarHeader className="mobile-nav-header">
          <div className="mobile-nav-brand">
            <Image
              src="/images/receipt-printer-logo.svg"
              alt=""
              width={30}
              height={30}
            />
            <div>
              <strong>Invoice Generator</strong>
              <span>Workspace navigation</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    item.href === "/"
                      ? pathname === "/" || pathname === "/invoice"
                      : pathname.startsWith(item.href)

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="mobile-nav-footer">
          <ThemeToggle />
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  )
}
