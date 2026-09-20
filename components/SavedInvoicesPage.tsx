"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { EyeIcon, RefreshCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MobileNavigation } from "@/components/MobileNavigation"
import { ThemeToggle } from "@/components/theme-provider"

type CurrencyCode =
  "USD" | "EUR" | "GBP" | "TRY" | "JPY" | "CAD" | "AUD" | "INR"
type TaxMode = "exclusive" | "inclusive"

type Party = {
  name: string
  email: string
  address: string
  city: string
  state: string
  zip: string
  phone?: string
  gstNo: string
}

type InvoiceItem = {
  id?: string
  description: string
  qty: number
  price: number
  discount: number
  taxRate: number
  taxMode: TaxMode
  productId?: string
  productSku?: string
  productStockQty?: number
}

type SavedInvoice = {
  _id: string
  invoiceNumber: string
  clientName: string
  issueDate: string
  dueDate: string
  currency: string
  business?: Partial<Party>
  client?: Partial<Party>
  items?: InvoiceItem[]
  notes?: string
  total: number
}

type InvoiceState = {
  business: Required<Party>
  client: Omit<Party, "phone"> & { phone?: string }
  meta: {
    number: string
    issueDate: string
    dueDate: string
    currency: CurrencyCode
  }
  items: Array<InvoiceItem & { id: string }>
  taxRate: number
  discount: number
  notes: string
}

const STORAGE_KEY = "invoice-generator-v1"
const PAGE_SIZE = 10
const CURRENCIES: CurrencyCode[] = [
  "USD",
  "EUR",
  "GBP",
  "TRY",
  "JPY",
  "CAD",
  "AUD",
  "INR",
]

const DEFAULT_STATE: InvoiceState = {
  business: {
    name: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    gstNo: "",
  },
  client: {
    name: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    gstNo: "",
  },
  meta: {
    number: "INV-0001",
    issueDate: todayISO(),
    dueDate: todayISO(),
    currency: "USD",
  },
  items: [
    {
      id: "item-1",
      description: "",
      qty: 1,
      price: 0,
      discount: 0,
      taxRate: 0,
      taxMode: "exclusive",
    },
  ],
  taxRate: 0,
  discount: 0,
  notes: "Thank you for your business!",
}

let uid = 0
const newId = () => `item-${Date.now()}-${uid++}`

export function SavedInvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<SavedInvoice[]>([])
  const [page, setPage] = useState(1)
  const [totalInvoices, setTotalInvoices] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })

      const response = await fetch(`/api/invoices?${params.toString()}`)
      const data = (await response.json().catch(() => null)) as {
        invoices?: SavedInvoice[]
        total?: number
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load saved invoices")
      }

      setInvoices(Array.isArray(data?.invoices) ? data.invoices : [])
      setTotalInvoices(Number(data?.total) || 0)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load saved invoices"
      )
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  const viewInvoice = useCallback(
    (invoice: SavedInvoice) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toInvoiceState(invoice)))
      router.push("/invoice")
    },
    [router]
  )

  const totalPages = Math.max(1, Math.ceil(totalInvoices / PAGE_SIZE))
  const firstVisibleInvoice = totalInvoices ? (page - 1) * PAGE_SIZE + 1 : 0
  const lastVisibleInvoice = Math.min(page * PAGE_SIZE, totalInvoices)

  return (
    <div className="app">
      <header className="header no-print">
        <div className="header-inner">
          <div className="header-left">
            <Image
              src="/images/receipt-printer-logo.svg"
              alt=""
              className="app-logo"
              width={34}
              height={34}
              priority
            />
            <div>
              <h1 className="header-title">Saved Invoices</h1>
              <p className="header-sub">Generated invoice archive</p>
            </div>
          </div>
          <div className="header-right">
            <MobileNavigation />
            <ThemeToggle />
            <Link className="btn-ghost nav-link desktop-nav-link" href="/">
              Invoice
            </Link>
            <Link
              className="btn-ghost nav-link desktop-nav-link"
              href="/inventory"
            >
              Inventory
            </Link>
            <Link
              className="btn-ghost nav-link desktop-nav-link"
              href="/saved-invoices"
              aria-current="page"
            >
              Saved
            </Link>
            <Button className="btn-ghost" onClick={loadInvoices}>
              <RefreshCcwIcon aria-hidden="true" /> Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="main saved-invoices-main">
        <section className="panel saved-invoices-panel">
          <div className="inventory-list-head">
            <div>
              <span className="inventory-kicker">Archive</span>
              <h2>Past invoices</h2>
            </div>
            <span className="inventory-list-count">
              {totalInvoices
                ? `${firstVisibleInvoice}-${lastVisibleInvoice} of ${totalInvoices}`
                : "0 saved"}
            </span>
          </div>

          {error ? (
            <div className="invoice-error saved-invoices-error">{error}</div>
          ) : loading ? (
            <div className="saved-invoices-empty">
              Loading saved invoices...
            </div>
          ) : invoices.length ? (
            <div className="saved-invoices-list">
              {invoices.map((invoice) => (
                <div className="saved-invoice" key={invoice._id}>
                  <div>
                    <strong>{invoice.invoiceNumber}</strong>
                    <span>
                      {invoice.clientName || "Client"} -{" "}
                      {formatDateLabel(invoice.issueDate)}
                    </span>
                  </div>
                  <b>
                    {formatMoney(
                      invoice.total,
                      isCurrencyCode(invoice.currency)
                        ? invoice.currency
                        : DEFAULT_STATE.meta.currency
                    )}
                  </b>
                  <Button
                    className="btn-import"
                    type="button"
                    variant="outline"
                    onClick={() => viewInvoice(invoice)}
                  >
                    <EyeIcon aria-hidden="true" /> View
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="saved-invoices-empty">
              Generated invoices will appear here after they are saved.
            </div>
          )}
          {totalPages > 1 && (
            <nav className="inventory-pagination" aria-label="Invoice pages">
              <Button
                className="btn-ghost"
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1 || loading}
              >
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                className="btn-ghost"
                variant="outline"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page === totalPages || loading}
              >
                Next
              </Button>
            </nav>
          )}
        </section>
      </main>
    </div>
  )
}

function toInvoiceState(invoice: SavedInvoice): InvoiceState {
  const currency = isCurrencyCode(invoice.currency)
    ? invoice.currency
    : DEFAULT_STATE.meta.currency

  return {
    ...DEFAULT_STATE,
    business: normalizeParty<InvoiceState["business"]>(
      DEFAULT_STATE.business,
      invoice.business
    ),
    client: normalizeParty<InvoiceState["client"]>(DEFAULT_STATE.client, {
      ...invoice.client,
      name: invoice.client?.name || invoice.clientName,
    }),
    meta: {
      number: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency,
    },
    items:
      Array.isArray(invoice.items) && invoice.items.length
        ? invoice.items.map((item) => ({
            id: asString(item.id) || newId(),
            description: asString(item.description),
            qty: asNumber(item.qty, 1),
            price: asNumber(item.price),
            discount: asNumber(item.discount),
            taxRate: asNumber(item.taxRate),
            taxMode: isTaxMode(item.taxMode) ? item.taxMode : "exclusive",
            productId: asString(item.productId) || undefined,
            productSku: asString(item.productSku) || undefined,
            productStockQty:
              typeof item.productStockQty === "number"
                ? item.productStockQty
                : undefined,
          }))
        : DEFAULT_STATE.items.map((item) => ({ ...item, id: newId() })),
    notes: asString(invoice.notes, DEFAULT_STATE.notes),
  }
}

function normalizeParty<T extends Party>(defaults: T, saved?: Partial<T>): T {
  return {
    ...defaults,
    ...saved,
    name: asString(saved?.name, defaults.name),
    email: asString(saved?.email, defaults.email),
    address: asString(saved?.address, defaults.address),
    city: asString(saved?.city, defaults.city),
    state: asString(saved?.state, defaults.state),
    zip: asString(saved?.zip, defaults.zip),
    phone: asString(saved?.phone, defaults.phone),
    gstNo: asString(saved?.gstNo, defaults.gstNo),
  } as T
}

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return CURRENCIES.some((currency) => currency === value)
}

function isTaxMode(value: unknown): value is TaxMode {
  return value === "exclusive" || value === "inclusive"
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatMoney(value: number, currency: CurrencyCode) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0)
  } catch {
    return (Number(value) || 0).toFixed(2)
  }
}

function formatDateLabel(iso: string) {
  if (!iso) return "-"
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}
