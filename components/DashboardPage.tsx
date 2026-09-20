"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  ArchiveIcon,
  ArrowUpRightIcon,
  BoxesIcon,
  CheckCircle2Icon,
  FilePlus2Icon,
  LayoutDashboardIcon,
  MenuIcon,
  PlusIcon,
  ReceiptTextIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react"

import { ThemeToggle } from "@/components/theme-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type CurrencyCode =
  "USD" | "EUR" | "GBP" | "TRY" | "JPY" | "CAD" | "AUD" | "INR"

type Invoice = {
  _id: string
  invoiceNumber: string
  clientName: string
  issueDate: string
  dueDate: string
  currency: string
  total: number
}

const navigationItems = [
  { href: "/", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/invoice/new", label: "Invoice", icon: FilePlus2Icon },
  { href: "/inventory", label: "Inventory", icon: BoxesIcon },
  { href: "/saved-invoices", label: "Saved invoices", icon: ArchiveIcon },
]

const shortcutItems = [
  { href: "/invoice/new", label: "Create new invoice", icon: PlusIcon },
  { href: "/inventory", label: "Manage stock", icon: BoxesIcon },
]

const currencyCodes: CurrencyCode[] = [
  "USD",
  "EUR",
  "GBP",
  "TRY",
  "JPY",
  "CAD",
  "AUD",
  "INR",
]

export function DashboardPage() {
  const pathname = usePathname()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadInvoices() {
      try {
        const response = await fetch("/api/invoices?page=1&pageSize=5")
        const data = (await response.json().catch(() => null)) as {
          invoices?: Invoice[]
        } | null

        if (active && response.ok) {
          setInvoices(Array.isArray(data?.invoices) ? data.invoices : [])
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadInvoices()
    return () => {
      active = false
    }
  }, [])

  const metrics = useMemo(() => {
    const clients = new Set(
      invoices.map((invoice) => invoice.clientName).filter(Boolean)
    )
    const revenue = invoices.reduce(
      (sum, invoice) => sum + (Number(invoice.total) || 0),
      0
    )
    const currency = currencyCodes.includes(
      invoices[0]?.currency as CurrencyCode
    )
      ? (invoices[0].currency as CurrencyCode)
      : "INR"

    return {
      clients: clients.size,
      currency,
      revenue,
    }
  }, [invoices])

  return (
    <SidebarProvider className="dashboard-shell">
      <DashboardSidebar pathname={pathname} />
      <SidebarInset className="dashboard-inset">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-heading">
            <SidebarTrigger className="dashboard-menu-trigger">
              <MenuIcon aria-hidden="true" />
            </SidebarTrigger>
            <div>
              <span className="dashboard-eyebrow">Workspace</span>
              <h1>Overview</h1>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <main className="dashboard-main">
          <section className="dashboard-welcome">
            <div>
              <span className="dashboard-eyebrow">Operations snapshot</span>
              <h2>Keep your business moving.</h2>
              <p>
                Draft invoices, monitor stock, and revisit recent work from one
                place.
              </p>
            </div>
            <Button
              className="dashboard-primary-action"
              render={<Link href="/invoice/new" />}
              nativeButton={false}
            >
              <PlusIcon aria-hidden="true" /> New invoice
            </Button>
          </section>

          <section className="dashboard-metrics" aria-label="Business metrics">
            <MetricCard
              label="Invoices this month"
              value={loading ? "..." : String(invoices.length)}
              detail="Latest saved records"
              icon={ReceiptTextIcon}
              tone="teal"
            />
            <MetricCard
              label="Revenue tracked"
              value={
                loading ? "..." : formatMoney(metrics.revenue, metrics.currency)
              }
              detail="Across recent invoices"
              icon={TrendingUpIcon}
              tone="blue"
            />
            <MetricCard
              label="Active clients"
              value={loading ? "..." : String(metrics.clients)}
              detail="Unique recent clients"
              icon={CheckCircle2Icon}
              tone="amber"
            />
            <MetricCard
              label="Catalog health"
              value="Ready"
              detail="Inventory is available"
              icon={BoxesIcon}
              tone="violet"
            />
          </section>

          <section className="dashboard-grid">
            <Card className="dashboard-card dashboard-recent-card gap-0 py-0">
              <CardHeader className="dashboard-card-header">
                <div>
                  <CardTitle>Recent invoices</CardTitle>
                  <CardDescription>
                    Your latest billing activity
                  </CardDescription>
                </div>
                <Button
                  className="dashboard-icon-action"
                  variant="ghost"
                  size="icon-sm"
                  render={<Link href="/saved-invoices" />}
                  nativeButton={false}
                  aria-label="View all saved invoices"
                >
                  <ArrowUpRightIcon aria-hidden="true" />
                </Button>
              </CardHeader>
              <CardContent className="dashboard-card-content">
                {loading ? (
                  <div className="dashboard-empty-state">
                    Loading activity...
                  </div>
                ) : invoices.length ? (
                  <div className="dashboard-invoice-list">
                    {invoices.map((invoice) => (
                      <div className="dashboard-invoice-row" key={invoice._id}>
                        <div className="dashboard-invoice-icon">
                          <ReceiptTextIcon aria-hidden="true" />
                        </div>
                        <div className="dashboard-invoice-copy">
                          <strong>{invoice.invoiceNumber}</strong>
                          <span>{invoice.clientName || "Client"}</span>
                        </div>
                        <div className="dashboard-invoice-meta">
                          <strong>
                            {formatMoney(
                              invoice.total,
                              currencyCodes.includes(
                                invoice.currency as CurrencyCode
                              )
                                ? (invoice.currency as CurrencyCode)
                                : "INR"
                            )}
                          </strong>
                          <span>{formatDate(invoice.issueDate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-empty-state">
                    No invoices yet. Start with your first draft.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="dashboard-card dashboard-quick-card gap-0 py-0">
              <CardHeader className="dashboard-card-header">
                <div>
                  <CardTitle>Quick actions</CardTitle>
                  <CardDescription>
                    Shortcuts for your daily workflow
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="dashboard-quick-content">
                <Link className="dashboard-quick-action" href="/invoice/new">
                  <span className="dashboard-quick-icon is-teal">
                    <FilePlus2Icon aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Create an invoice</strong>
                    <small>Build a polished tax invoice</small>
                  </span>
                  <ArrowUpRightIcon aria-hidden="true" />
                </Link>
                <Link className="dashboard-quick-action" href="/inventory">
                  <span className="dashboard-quick-icon is-blue">
                    <BoxesIcon aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Manage inventory</strong>
                    <small>Update products and stock</small>
                  </span>
                  <ArrowUpRightIcon aria-hidden="true" />
                </Link>
                <Link className="dashboard-quick-action" href="/saved-invoices">
                  <span className="dashboard-quick-icon is-amber">
                    <ArchiveIcon aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Browse archive</strong>
                    <small>Find previously saved invoices</small>
                  </span>
                  <ArrowUpRightIcon aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          </section>

          <section
            className="dashboard-insight"
            aria-label="Workspace readiness"
          >
            <div className="dashboard-insight-icon">
              <SparklesIcon aria-hidden="true" />
            </div>
            <div className="dashboard-insight-copy">
              <Badge variant="outline">Workflow ready</Badge>
              <strong>Everything you need to send the next invoice.</strong>
              <span>
                Connect your product catalog and keep client details close at
                hand.
              </span>
            </div>
            <div className="dashboard-insight-progress">
              <div>
                <span>Workspace setup</span>
                <strong>75%</strong>
              </div>
              <Progress value={75} />
            </div>
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export function DashboardSidebar({ pathname }: { pathname: string }) {
  return (
    <Sidebar className="dashboard-sidebar" collapsible="icon">
      <SidebarHeader className="dashboard-sidebar-header">
        <Link className="dashboard-brand" href="/">
          <Image
            src="/images/receipt-printer-logo.svg"
            alt=""
            width={34}
            height={34}
            priority
          />
          <span>
            <strong>Invoice Generator</strong>
            <small>Business workspace</small>
          </span>
        </Link>
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
                    ? pathname === "/"
                    : item.href === "/invoice/new"
                      ? pathname.startsWith("/invoice")
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
        <SidebarSeparator className="dashboard-section-separator" />
        <SidebarGroup>
          <SidebarGroupLabel>Shortcuts</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {shortcutItems.map((item) => {
                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<Link href={item.href} />}>
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
      <SidebarFooter className="dashboard-sidebar-footer">
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  )
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string
  icon: typeof ReceiptTextIcon
  label: string
  tone: string
  value: string
}) {
  return (
    <Card className="dashboard-metric-card">
      <CardContent>
        <div className="dashboard-metric-topline">
          <span>{label}</span>
          <span className={`dashboard-metric-icon is-${tone}`}>
            <Icon aria-hidden="true" />
          </span>
        </div>
        <strong>{value}</strong>
        <small>{detail}</small>
      </CardContent>
    </Card>
  )
}

function formatMoney(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function formatDate(value: string) {
  if (!value) return "No date"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date)
}
