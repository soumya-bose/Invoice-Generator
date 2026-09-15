"use client"

import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { CalendarIcon, ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field as FormField, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ReceiptPrinter } from "@/components/ReceiptPrinter"

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD — US Dollar" },
  { code: "EUR", symbol: "€", label: "EUR — Euro" },
  { code: "GBP", symbol: "£", label: "GBP — British Pound" },
  { code: "TRY", symbol: "₺", label: "TRY — Turkish Lira" },
  { code: "JPY", symbol: "¥", label: "JPY — Japanese Yen" },
  { code: "CAD", symbol: "$", label: "CAD — Canadian Dollar" },
  { code: "AUD", symbol: "$", label: "AUD — Australian Dollar" },
  { code: "INR", symbol: "₹", label: "INR — Indian Rupee" },
]

const STORAGE_KEY = "invoice-generator-v1"
const DISCOUNT_OPTIONS = [0, 2.5, 5, 10, 15, 20]
const TAX_OPTIONS = [0, 5, 8, 12, 18, 28]

let uid = 0
const newId = () => `item-${Date.now()}-${uid++}`

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function plusDaysISO(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const DEFAULT_STATE = {
  business: { name: "", email: "", address: "", phone: "", gstNo: "" },
  client: { name: "", email: "", address: "", gstNo: "" },
  meta: {
    number: "INV-0001",
    issueDate: todayISO(),
    dueDate: plusDaysISO(14),
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

const SAMPLE_STATE = {
  business: {
    name: "Acme Studio",
    email: "hello@acmestudio.com",
    address: "123 Market St, Suite 4\nSan Francisco, CA 94103",
    phone: "+1 (555) 018-2245",
    gstNo: "29ABCDE1234F1Z5",
  },
  client: {
    name: "Nova Coffee Co.",
    email: "billing@novacoffee.com",
    address: "456 Client Ave\nNew York, NY 10012",
    gstNo: "27AAACN0000A1Z5",
  },
  meta: {
    number: "INV-0042",
    issueDate: todayISO(),
    dueDate: plusDaysISO(14),
    currency: "USD",
  },
  items: [
    {
      id: newId(),
      description: "Brand identity & logo design",
      qty: 1,
      price: 1800,
      discount: 5,
      taxRate: 18,
      taxMode: "exclusive",
    },
    {
      id: newId(),
      description: "Website UI design (5 pages)",
      qty: 5,
      price: 320,
      discount: 0,
      taxRate: 18,
      taxMode: "inclusive",
    },
    {
      id: newId(),
      description: "Design revision rounds",
      qty: 3,
      price: 120,
      discount: 10,
      taxRate: 12,
      taxMode: "exclusive",
    },
  ],
  taxRate: 8,
  discount: 5,
  notes:
    "Payment due within 14 days via bank transfer.\nThank you for your business!",
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_STATE,
      ...parsed,
      business: { ...DEFAULT_STATE.business, ...parsed.business },
      client: { ...DEFAULT_STATE.client, ...parsed.client },
      meta: { ...DEFAULT_STATE.meta, ...parsed.meta },
      items:
        Array.isArray(parsed.items) && parsed.items.length
          ? parsed.items.map((i) => ({
              id: i.id || newId(),
              description: i.description || "",
              qty: i.qty ?? 1,
              price: i.price ?? 0,
              discount: i.discount ?? parsed.discount ?? 0,
              taxRate: i.taxRate ?? parsed.taxRate ?? 0,
              taxMode: i.taxMode || "exclusive",
            }))
          : DEFAULT_STATE.items,
    }
  } catch {
    return DEFAULT_STATE
  }
}

function formatMoney(value, currency) {
  const num = Number.isFinite(value) ? value : 0
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return num.toFixed(2)
  }
}

function formatDateLabel(iso) {
  if (!iso) return "—"
  const d = new Date(iso + "T00:00:00")
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d)
}

function isoToDate(iso) {
  if (!iso) return undefined
  const date = new Date(iso + "T00:00:00")
  return Number.isNaN(date.getTime()) ? undefined : date
}

function dateToISO(date) {
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export default function App() {
  const pathname = usePathname()
  const router = useRouter()
  const [state, setState] = useState(DEFAULT_STATE)
  const isLoaded = useRef(false)
  const [receiptStage, setReceiptStage] = useState(() =>
    pathname === "/invoice" ? "complete" : "processing"
  )
  const [showReceiptPrinter, setShowReceiptPrinter] = useState(
    () => pathname === "/invoice"
  )
  const [invoiceGenerated, setInvoiceGenerated] = useState(
    () => pathname === "/invoice"
  )
  const generationTimers = useRef([])

  const { business, client, meta, items, notes } = state
  const isInvoiceRoute = pathname === "/invoice"

  useEffect(() => {
    setState(loadState())
    isLoaded.current = true
  }, [])

  useEffect(() => {
    if (!isLoaded.current) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        /* ignore quota errors */
      }
    }, 300)
    return () => clearTimeout(t)
  }, [state])

  const clearGenerationTimers = useCallback(() => {
    generationTimers.current.forEach((timer) => window.clearTimeout(timer))
    generationTimers.current = []
  }, [])

  useEffect(() => clearGenerationTimers, [clearGenerationTimers])

  const markInvoiceDirty = useCallback(() => {
    clearGenerationTimers()
    setInvoiceGenerated(false)
    setShowReceiptPrinter(false)
    setReceiptStage("processing")
  }, [clearGenerationTimers])

  // ── field helpers ────────────────────────────────
  const setField = useCallback(
    (section, key, value) => {
      markInvoiceDirty()
      setState((s) => ({ ...s, [section]: { ...s[section], [key]: value } }))
    },
    [markInvoiceDirty]
  )

  const setTop = useCallback(
    (key, value) => {
      markInvoiceDirty()
      setState((s) => ({ ...s, [key]: value }))
    },
    [markInvoiceDirty]
  )

  const updateItem = useCallback(
    (id, key, value) => {
      markInvoiceDirty()
      setState((s) => ({
        ...s,
        items: s.items.map((it) =>
          it.id === id ? { ...it, [key]: value } : it
        ),
      }))
    },
    [markInvoiceDirty]
  )

  const addItem = useCallback(() => {
    markInvoiceDirty()
    setState((s) => ({
      ...s,
      items: [
        ...s.items,
        {
          id: newId(),
          description: "",
          qty: 1,
          price: 0,
          discount: 0,
          taxRate: 0,
          taxMode: "exclusive",
        },
      ],
    }))
  }, [markInvoiceDirty])

  const removeItem = useCallback(
    (id) => {
      markInvoiceDirty()
      setState((s) => ({
        ...s,
        items:
          s.items.length > 1 ? s.items.filter((it) => it.id !== id) : s.items,
      }))
    },
    [markInvoiceDirty]
  )

  const resetAll = useCallback(() => {
    markInvoiceDirty()
    const fresh = {
      ...DEFAULT_STATE,
      items: [
        {
          id: newId(),
          description: "",
          qty: 1,
          price: 0,
          discount: 0,
          taxRate: 0,
          taxMode: "exclusive",
        },
      ],
      meta: {
        ...DEFAULT_STATE.meta,
        issueDate: todayISO(),
        dueDate: plusDaysISO(14),
      },
    }
    setState(fresh)
  }, [markInvoiceDirty])

  const loadSample = useCallback(() => {
    markInvoiceDirty()
    setState({
      ...SAMPLE_STATE,
      items: SAMPLE_STATE.items.map((it) => ({ ...it, id: newId() })),
      meta: {
        ...SAMPLE_STATE.meta,
        issueDate: todayISO(),
        dueDate: plusDaysISO(14),
      },
    })
  }, [markInvoiceDirty])

  // ── calculations ─────────────────────────────────
  const currency = meta.currency
  const currencyMeta =
    CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0]

  const calc = useMemo(() => {
    const lines = items.map((it) => {
      const qty = Number(it.qty) || 0
      const price = Number(it.price) || 0
      const discountRate = Number(it.discount) || 0
      const taxRate = Number(it.taxRate) || 0
      const taxMultiplier = 1 + taxRate / 100
      const amount = qty * price
      const discountAmount = amount * (discountRate / 100)
      const discounted = Math.max(0, amount - discountAmount)
      const isInclusive = it.taxMode === "inclusive" && taxRate > 0
      const taxable = isInclusive ? discounted / taxMultiplier : discounted
      const taxAmount = isInclusive
        ? discounted - taxable
        : taxable * (taxRate / 100)
      const total = isInclusive ? discounted : taxable + taxAmount

      return { id: it.id, amount, discountAmount, taxable, taxAmount, total }
    })
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
    const discountAmount = lines.reduce(
      (sum, line) => sum + line.discountAmount,
      0
    )
    const taxable = lines.reduce((sum, line) => sum + line.taxable, 0)
    const taxAmount = lines.reduce((sum, line) => sum + line.taxAmount, 0)
    const total = lines.reduce((sum, line) => sum + line.total, 0)

    return { subtotal, discountAmount, taxable, taxAmount, total, lines }
  }, [items])

  const handleGenerateInvoice = useCallback(() => {
    clearGenerationTimers()
    setInvoiceGenerated(false)
    setShowReceiptPrinter(true)
    setReceiptStage("processing")

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore quota errors */
    }

    const printingTimer = window.setTimeout(() => {
      setReceiptStage("printing")
    }, 500)

    const completeTimer = window.setTimeout(() => {
      setReceiptStage("complete")
      setInvoiceGenerated(true)
      router.push("/invoice")
    }, 4300)

    generationTimers.current = [printingTimer, completeTimer]
  }, [clearGenerationTimers, router, state])

  const handleReplayReceipt = useCallback(() => {
    clearGenerationTimers()
    setShowReceiptPrinter(true)
    setReceiptStage("processing")

    const printingTimer = window.setTimeout(() => {
      setReceiptStage("printing")
    }, 500)

    const completeTimer = window.setTimeout(() => {
      setReceiptStage("complete")
      setInvoiceGenerated(true)
    }, 4300)

    generationTimers.current = [printingTimer, completeTimer]
  }, [clearGenerationTimers])

  const handleEditInvoice = useCallback(() => {
    clearGenerationTimers()
    setShowReceiptPrinter(false)
    setInvoiceGenerated(false)
    setReceiptStage("processing")
    router.push("/")
  }, [clearGenerationTimers, router])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const isGenerating = showReceiptPrinter && !invoiceGenerated

  const isPrinterRunning = receiptStage !== "complete"

  return (
    <div className="app">
      {/* Header */}
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
              <h1 className="header-title">Invoice Generator</h1>
              <p className="header-sub">
                Create clean, professional invoices in seconds
              </p>
            </div>
          </div>
          <div className="header-right">
            {isInvoiceRoute ? (
              <Button
                className="btn-ghost"
                onClick={handleEditInvoice}
                aria-label="Edit invoice"
              >
                Edit
              </Button>
            ) : (
              <>
                <Button
                  className="btn-ghost"
                  onClick={loadSample}
                  aria-label="Load sample data"
                >
                  Sample
                </Button>
                <Button
                  className="btn-ghost"
                  onClick={resetAll}
                  aria-label="Reset invoice"
                >
                  Reset
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="main">
        <div className={isInvoiceRoute ? "invoice-view" : "form-view"}>
          {/* ─── Editor ─────────────────────────── */}
          {!isInvoiceRoute && (
            <section className="editor no-print" aria-label="Invoice editor">
              <Panel title="Your Business">
                <div className="field-grid">
                  <Field label="Business name" full>
                    <Input
                      className="in"
                      value={business.name}
                      onChange={(e) =>
                        setField("business", "name", e.target.value)
                      }
                      placeholder="Acme Studio"
                      aria-label="Business name"
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      className="in"
                      value={business.email}
                      onChange={(e) =>
                        setField("business", "email", e.target.value)
                      }
                      placeholder="hello@acme.com"
                      aria-label="Business email"
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      className="in"
                      value={business.phone}
                      onChange={(e) =>
                        setField("business", "phone", e.target.value)
                      }
                      placeholder="+1 555 000 0000"
                      aria-label="Business phone"
                    />
                  </Field>
                  <Field label="GST No.">
                    <Input
                      className="in"
                      value={business.gstNo}
                      onChange={(e) =>
                        setField("business", "gstNo", e.target.value)
                      }
                      placeholder="29ABCDE1234F1Z5"
                      aria-label="Business GST number"
                    />
                  </Field>
                  <Field label="Address" full>
                    <Textarea
                      className="in ta"
                      rows={2}
                      value={business.address}
                      onChange={(e) =>
                        setField("business", "address", e.target.value)
                      }
                      placeholder="123 Market St, Suite 4&#10;San Francisco, CA"
                      aria-label="Business address"
                    />
                  </Field>
                </div>
              </Panel>

              <Panel title="Bill To">
                <div className="field-grid">
                  <Field label="Client name" full>
                    <Input
                      className="in"
                      value={client.name}
                      onChange={(e) =>
                        setField("client", "name", e.target.value)
                      }
                      placeholder="Jane Client"
                      aria-label="Client name"
                    />
                  </Field>
                  <Field label="Email" full>
                    <Input
                      className="in"
                      value={client.email}
                      onChange={(e) =>
                        setField("client", "email", e.target.value)
                      }
                      placeholder="jane@company.com"
                      aria-label="Client email"
                    />
                  </Field>
                  <Field label="GST No." full>
                    <Input
                      className="in"
                      value={client.gstNo}
                      onChange={(e) =>
                        setField("client", "gstNo", e.target.value)
                      }
                      placeholder="27AAACN0000A1Z5"
                      aria-label="Client GST number"
                    />
                  </Field>
                  <Field label="Address" full>
                    <Textarea
                      className="in ta"
                      rows={2}
                      value={client.address}
                      onChange={(e) =>
                        setField("client", "address", e.target.value)
                      }
                      placeholder="456 Client Ave&#10;New York, NY"
                      aria-label="Client address"
                    />
                  </Field>
                </div>
              </Panel>

              <Panel title="Invoice Details">
                <div className="field-grid">
                  <Field label="Invoice #">
                    <Input
                      className="in"
                      value={meta.number}
                      onChange={(e) =>
                        setField("meta", "number", e.target.value)
                      }
                      placeholder="INV-0001"
                      aria-label="Invoice number"
                    />
                  </Field>
                  <Field label="Currency">
                    <Select
                      value={meta.currency}
                      onValueChange={(value) =>
                        setField("meta", "currency", value)
                      }
                    >
                      <SelectTrigger
                        className="select-trigger"
                        aria-label="Currency"
                      >
                        <SelectValue>
                          {(value) => {
                            const selected =
                              CURRENCIES.find((c) => c.code === value) ||
                              currencyMeta

                            return (
                              <span className="currency-value">
                                <span>{selected.code}</span>
                                <span>{selected.symbol}</span>
                              </span>
                            )
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="select-menu" align="start">
                        {CURRENCIES.map((c) => (
                          <SelectItem
                            className="select-menu-item"
                            key={c.code}
                            value={c.code}
                          >
                            <span className="currency-option">
                              <span>{c.code}</span>
                              <span>{c.label.replace(`${c.code} — `, "")}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Issue date">
                    <DatePicker
                      value={meta.issueDate}
                      onChange={(value) => setField("meta", "issueDate", value)}
                      ariaLabel="Issue date"
                    />
                  </Field>
                  <Field label="Due date">
                    <DatePicker
                      value={meta.dueDate}
                      onChange={(value) => setField("meta", "dueDate", value)}
                      ariaLabel="Due date"
                    />
                  </Field>
                </div>
              </Panel>

              <Panel title="Line Items">
                <div className="items-editor">
                  <div className="item-head">
                    <span className="ih-desc">Description</span>
                    <span className="ih-qty">Qty</span>
                    <span className="ih-price">Price</span>
                    <span className="ih-discount">Disc %</span>
                    <span className="ih-tax">Tax %</span>
                    <span className="ih-mode">Tax type</span>
                    <span className="ih-amt">Amount</span>
                    <span className="ih-del" />
                  </div>
                  {items.map((it) => {
                    const line = calc.lines.find((entry) => entry.id === it.id)
                    return (
                      <div className="item-row" key={it.id}>
                        <Input
                          className="in item-desc"
                          value={it.description}
                          onChange={(e) =>
                            updateItem(it.id, "description", e.target.value)
                          }
                          placeholder="Design services"
                          aria-label="Item description"
                        />
                        <div className="item-control item-qty">
                          <span>Qty</span>
                          <Input
                            className="in item-num"
                            type="number"
                            min="0"
                            step="1"
                            value={it.qty}
                            onChange={(e) =>
                              updateItem(
                                it.id,
                                "qty",
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value)
                              )
                            }
                            aria-label="Quantity"
                          />
                        </div>
                        <div className="item-control item-price">
                          <span>Price</span>
                          <Input
                            className="in item-num"
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.price}
                            onChange={(e) =>
                              updateItem(
                                it.id,
                                "price",
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value)
                              )
                            }
                            aria-label="Unit price"
                          />
                        </div>
                        <div className="item-control item-discount">
                          <span>Disc</span>
                          <RateDropdown
                            label="Discount"
                            value={it.discount}
                            options={DISCOUNT_OPTIONS}
                            onChange={(value) =>
                              updateItem(it.id, "discount", value)
                            }
                          />
                        </div>
                        <div className="item-control item-tax">
                          <span>Tax</span>
                          <RateDropdown
                            label="Tax"
                            value={it.taxRate}
                            options={TAX_OPTIONS}
                            onChange={(value) =>
                              updateItem(it.id, "taxRate", value)
                            }
                          />
                        </div>
                        <TaxModeDropdown
                          value={it.taxMode || "exclusive"}
                          onChange={(value) =>
                            updateItem(it.id, "taxMode", value)
                          }
                        />
                        <div className="item-total">
                          <span>{formatMoney(line?.total ?? 0, currency)}</span>
                          <Button
                            className="del-btn"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(it.id)}
                            disabled={items.length <= 1}
                            aria-label="Remove item"
                          >
                            <IconTrash />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Button
                  className="btn-add"
                  variant="outline"
                  onClick={addItem}
                  aria-label="Add line item"
                >
                  <IconPlus /> Add item
                </Button>
              </Panel>

              <Panel title="Totals & Notes">
                <div className="totals-card" aria-label="Invoice totals">
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatMoney(calc.subtotal, currency)}</strong>
                  </div>
                  <div>
                    <span>Line discounts</span>
                    <strong>
                      -{formatMoney(calc.discountAmount, currency)}
                    </strong>
                  </div>
                  <div>
                    <span>Tax</span>
                    <strong>{formatMoney(calc.taxAmount, currency)}</strong>
                  </div>
                  <div className="totals-grand">
                    <span>Total</span>
                    <strong>{formatMoney(calc.total, currency)}</strong>
                  </div>
                </div>
                <div className="field-grid">
                  <Field label="Notes" full>
                    <Textarea
                      className="in ta"
                      rows={2}
                      value={notes}
                      onChange={(e) => setTop("notes", e.target.value)}
                      placeholder="Payment terms, thank-you note…"
                      aria-label="Notes"
                    />
                  </Field>
                </div>
              </Panel>

              <div className="generate-actions">
                <Button
                  className="btn-primary btn-generate"
                  onClick={handleGenerateInvoice}
                  disabled={isGenerating}
                  aria-label="Generate invoice"
                >
                  <IconReceipt />{" "}
                  {isGenerating ? "Generating..." : "Generate Invoice"}
                </Button>
              </div>
            </section>
          )}

          {/* ─── Preview ────────────────────────── */}
          {!isInvoiceRoute && showReceiptPrinter && (
            <section
              className="generation-overlay"
              aria-label="Generating invoice"
            >
              {showReceiptPrinter && (
                <ReceiptPrinter.Root
                  stage={receiptStage}
                  className="checkout-printer"
                >
                  <ReceiptPrinter.Machine>
                    <ReceiptPrinter.Header>
                      <div className="receipt-logo" aria-hidden="true">
                        <Image
                          src="/images/receipt-printer-logo.svg"
                          alt=""
                          width={34}
                          height={34}
                        />
                      </div>
                      <Button
                        className="receipt-home"
                        type="button"
                        variant="ghost"
                        onClick={() => router.push("/")}
                      >
                        <IconHome /> Home
                      </Button>
                    </ReceiptPrinter.Header>

                    <ReceiptPrinter.Screen>
                      <div className="receipt-screen-row">
                        <div>
                          <p>{items[0]?.description || "Invoice"}</p>
                          <span>{client.name || "Generated invoice"}</span>
                        </div>
                        <span className="receipt-screen-total-label">
                          Total
                        </span>
                        <strong>{formatMoney(calc.total, currency)}</strong>
                      </div>
                      <ReceiptPrinter.Status />
                    </ReceiptPrinter.Screen>
                  </ReceiptPrinter.Machine>

                  <ReceiptPrinter.Output>
                    <ReceiptPrinter.Paper>
                      <div className="receipt-paper-logo" aria-hidden="true">
                        <Image
                          src="/images/receipt-printer-logo.svg"
                          alt=""
                          width={40}
                          height={40}
                        />
                      </div>
                      <div className="receipt-paper-title">
                        {items[0]?.description || "Invoice"}
                      </div>
                      <div className="receipt-paper-meta">
                        <span>{meta.number || "Invoice"}</span>
                        <span>{formatDateLabel(meta.issueDate)}</span>
                      </div>
                      <div className="receipt-paper-rule" />
                      <div className="receipt-paper-parties">
                        <span>Paid to</span>
                        <strong>{business.name || "Your Business"}</strong>
                        <span>Paid by</span>
                        <strong>{client.name || "Client name"}</strong>
                      </div>
                      <div className="receipt-paper-items">
                        {items.map((it) => (
                          <div className="receipt-line" key={it.id}>
                            <span>{it.description || "Item description"}</span>
                            <strong>
                              {formatMoney(
                                calc.lines.find((line) => line.id === it.id)
                                  ?.total ?? 0,
                                currency
                              )}
                            </strong>
                          </div>
                        ))}
                      </div>
                      <div className="receipt-paper-rule" />
                      <div className="receipt-line">
                        <span>Subtotal</span>
                        <strong>{formatMoney(calc.subtotal, currency)}</strong>
                      </div>
                      {calc.discountAmount > 0 && (
                        <div className="receipt-line">
                          <span>Discount</span>
                          <strong>
                            -{formatMoney(calc.discountAmount, currency)}
                          </strong>
                        </div>
                      )}
                      {calc.taxAmount > 0 && (
                        <div className="receipt-line">
                          <span>Tax</span>
                          <strong>
                            {formatMoney(calc.taxAmount, currency)}
                          </strong>
                        </div>
                      )}
                      <div className="receipt-line receipt-total">
                        <span>Total paid</span>
                        <strong>{formatMoney(calc.total, currency)}</strong>
                      </div>
                      <div className="receipt-paper-rule" />
                      <div className="receipt-transaction">
                        <div>
                          <span>Order</span>
                          <strong>{meta.number || "INV-0001"}</strong>
                        </div>
                        <div>
                          <span>Date</span>
                          <strong>{formatDateLabel(meta.issueDate)}</strong>
                        </div>
                      </div>
                      <div className="receipt-barcode" aria-hidden="true">
                        {Array.from({ length: 52 }, (_, index) => (
                          <span key={index} />
                        ))}
                      </div>
                      <p className="receipt-thanks">
                        Thanks for your business.
                      </p>
                    </ReceiptPrinter.Paper>
                  </ReceiptPrinter.Output>
                </ReceiptPrinter.Root>
              )}
            </section>
          )}

          {isInvoiceRoute && (
            <section
              className="preview-wrap is-ready"
              aria-label="Generated invoice"
            >
              <ReceiptPrinter.Root
                stage={receiptStage}
                className="checkout-printer generated-printer no-print"
              >
                <ReceiptPrinter.Machine>
                  <ReceiptPrinter.Header>
                    <div className="receipt-logo" aria-hidden="true">
                      <Image
                        src="/images/receipt-printer-logo.svg"
                        alt=""
                        width={34}
                        height={34}
                      />
                    </div>
                    <Button
                      className="receipt-home"
                      type="button"
                      variant="ghost"
                      onClick={handleEditInvoice}
                    >
                      <IconHome /> Home
                    </Button>
                  </ReceiptPrinter.Header>

                  <ReceiptPrinter.Screen>
                    <div className="receipt-screen-row">
                      <div>
                        <p>{items[0]?.description || "Invoice"}</p>
                        <span>{client.name || "Generated invoice"}</span>
                      </div>
                      <span className="receipt-screen-total-label">Total</span>
                      <strong>{formatMoney(calc.total, currency)}</strong>
                    </div>
                    <ReceiptPrinter.Status />
                  </ReceiptPrinter.Screen>
                </ReceiptPrinter.Machine>

                <ReceiptPrinter.Output>
                  <ReceiptPrinter.Paper>
                    <div className="receipt-paper-logo" aria-hidden="true">
                      <Image
                        src="/images/receipt-printer-logo.svg"
                        alt=""
                        width={40}
                        height={40}
                      />
                    </div>
                    <div className="receipt-paper-title">
                      {items[0]?.description || "Invoice"}
                    </div>
                    <div className="receipt-paper-meta">
                      <span>{meta.number || "Invoice"}</span>
                      <span>{formatDateLabel(meta.issueDate)}</span>
                    </div>
                    <div className="receipt-paper-rule" />
                    <div className="receipt-paper-parties">
                      <span>Paid to</span>
                      <strong>{business.name || "Your Business"}</strong>
                      <span>Paid by</span>
                      <strong>{client.name || "Client name"}</strong>
                    </div>
                    <div className="receipt-paper-items">
                      {items.map((it) => (
                        <div className="receipt-line" key={it.id}>
                          <span>{it.description || "Item description"}</span>
                          <strong>
                            {formatMoney(
                              calc.lines.find((line) => line.id === it.id)
                                ?.total ?? 0,
                              currency
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <div className="receipt-paper-rule" />
                    <div className="receipt-line receipt-total">
                      <span>Total paid</span>
                      <strong>{formatMoney(calc.total, currency)}</strong>
                    </div>
                    <div className="receipt-paper-rule" />
                    <div className="receipt-transaction">
                      <div>
                        <span>Order</span>
                        <strong>{meta.number || "INV-0001"}</strong>
                      </div>
                      <div>
                        <span>Date</span>
                        <strong>{formatDateLabel(meta.issueDate)}</strong>
                      </div>
                    </div>
                    <div className="receipt-barcode" aria-hidden="true">
                      {Array.from({ length: 52 }, (_, index) => (
                        <span key={index} />
                      ))}
                    </div>
                    <p className="receipt-thanks">Thanks for your business.</p>
                  </ReceiptPrinter.Paper>
                </ReceiptPrinter.Output>
              </ReceiptPrinter.Root>

              <div className="invoice-result">
                <div className="invoice-result-actions no-print">
                  <Button
                    className="btn-ghost btn-replay"
                    variant="ghost"
                    onClick={handleReplayReceipt}
                    disabled={isPrinterRunning}
                    aria-label="Replay receipt generation"
                  >
                    <IconReplay /> {isPrinterRunning ? "Replaying" : "Replay"}
                  </Button>
                  <Button
                    className="btn-primary btn-download"
                    onClick={handlePrint}
                    aria-label="Download invoice as PDF"
                  >
                    <IconDownload /> Download PDF
                  </Button>
                </div>

                <TaxInvoiceDocument
                  business={business}
                  calc={calc}
                  client={client}
                  formatMoney={(value) => formatMoney(value, currency)}
                  items={items}
                  meta={meta}
                  notes={notes}
                />

                <div className="invoice-paper legacy-invoice-paper">
                  <div className="inv-top">
                    <div className="inv-brand">
                      <div className="inv-brand-name">
                        {business.name || "Your Business"}
                      </div>
                      <div className="inv-brand-meta">
                        {business.email && <div>{business.email}</div>}
                        {business.phone && <div>{business.phone}</div>}
                        {business.gstNo && <div>GST No. {business.gstNo}</div>}
                        {business.address && (
                          <div className="inv-multiline">
                            {business.address}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="inv-title-block">
                      <div className="inv-title">INVOICE</div>
                      <div className="inv-number">{meta.number || "—"}</div>
                    </div>
                  </div>

                  <div className="inv-parties">
                    <div className="inv-party">
                      <div className="inv-party-label">Bill To</div>
                      <div className="inv-party-name">
                        {client.name || "Client name"}
                      </div>
                      <div className="inv-party-meta">
                        {client.email && <div>{client.email}</div>}
                        {client.gstNo && <div>GST No. {client.gstNo}</div>}
                        {client.address && (
                          <div className="inv-multiline">{client.address}</div>
                        )}
                      </div>
                    </div>
                    <div className="inv-dates">
                      <div className="inv-date-row">
                        <span>Issue date</span>
                        <strong>{formatDateLabel(meta.issueDate)}</strong>
                      </div>
                      <div className="inv-date-row">
                        <span>Due date</span>
                        <strong>{formatDateLabel(meta.dueDate)}</strong>
                      </div>
                      <div className="inv-date-row total-due">
                        <span>Amount due</span>
                        <strong>{formatMoney(calc.total, currency)}</strong>
                      </div>
                    </div>
                  </div>

                  <table className="inv-table">
                    <thead>
                      <tr>
                        <th className="t-desc">Description</th>
                        <th className="t-qty">Qty</th>
                        <th className="t-price">Price</th>
                        <th className="t-price">Disc</th>
                        <th className="t-price">Tax</th>
                        <th className="t-amt">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => {
                        const line = calc.lines.find(
                          (entry) => entry.id === it.id
                        )

                        return (
                          <tr key={it.id}>
                            <td className="t-desc">
                              {it.description || (
                                <span className="t-empty">
                                  Item description
                                </span>
                              )}
                            </td>
                            <td className="t-qty">{Number(it.qty) || 0}</td>
                            <td className="t-price">
                              {formatMoney(Number(it.price) || 0, currency)}
                            </td>
                            <td className="t-price">
                              {Number(it.discount) || 0}%
                            </td>
                            <td className="t-price">
                              {Number(it.taxRate) || 0}%
                            </td>
                            <td className="t-amt">
                              {formatMoney(line?.total ?? 0, currency)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  <div className="inv-summary">
                    <div className="inv-sum-inner">
                      <div className="sum-row">
                        <span>Subtotal</span>
                        <span>{formatMoney(calc.subtotal, currency)}</span>
                      </div>
                      {calc.discountAmount > 0 && (
                        <div className="sum-row">
                          <span>Line discounts</span>
                          <span>
                            −{formatMoney(calc.discountAmount, currency)}
                          </span>
                        </div>
                      )}
                      {calc.taxAmount > 0 && (
                        <div className="sum-row">
                          <span>Tax</span>
                          <span>{formatMoney(calc.taxAmount, currency)}</span>
                        </div>
                      )}
                      <div className="sum-row grand">
                        <span>Total</span>
                        <span>{formatMoney(calc.total, currency)}</span>
                      </div>
                    </div>
                  </div>

                  {notes && (
                    <div className="inv-notes">
                      <div className="inv-notes-label">Notes</div>
                      <div className="inv-notes-text">{notes}</div>
                    </div>
                  )}

                  <div className="inv-foot">
                    Generated with Invoice Generator · {currencyMeta.code}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="credit no-print">Coded by Soumya</footer>
    </div>
  )
}

/* ─── Small building blocks ────────────────────── */
function DatePicker({ ariaLabel, onChange, value }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="date-trigger" aria-label={ariaLabel}>
        <CalendarIcon aria-hidden="true" />
        <span>{formatDateLabel(value)}</span>
        <ChevronDownIcon aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="date-popover" align="start">
        <Calendar
          mode="single"
          selected={isoToDate(value)}
          onSelect={(date) => {
            if (!date) return
            onChange(dateToISO(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function RateDropdown({ label, onChange, options, value }) {
  const current = Number(value) || 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rate-trigger"
        aria-label={`${label} percent`}
      >
        <span className="rate-value">{current}%</span>
        <ChevronDownIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="rate-menu" align="end">
        <DropdownMenuRadioGroup
          value={String(current)}
          onValueChange={(next) => onChange(Number(next))}
        >
          <DropdownMenuLabel className="rate-menu-label">
            {label}
          </DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuRadioItem
              className="rate-menu-item"
              key={option}
              value={String(option)}
            >
              <span>{option}%</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TaxModeDropdown({ onChange, value }) {
  const label = value === "inclusive" ? "Inclusive" : "Exclusive"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="tax-mode-trigger"
        aria-label="Tax calculation mode"
      >
        <span>{label}</span>
        <ChevronDownIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="tax-mode-menu" align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          <DropdownMenuLabel className="rate-menu-label">
            Tax type
          </DropdownMenuLabel>
          <DropdownMenuRadioItem className="rate-menu-item" value="exclusive">
            <span>Exclusive</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="rate-menu-item" value="inclusive">
            <span>Inclusive</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TaxInvoiceDocument({
  business,
  calc,
  client,
  formatMoney,
  items,
  meta,
}) {
  const visibleItems = items
    .filter((it) => it.description || Number(it.qty) || Number(it.price))
    .slice(0, 16)
  const printableRows = Array.from({
    length: Math.max(0, 16 - visibleItems.length),
  })
  const roundedTotal = Math.round(calc.total)
  const roundOff = roundedTotal - calc.total
  const businessAddressLines = String(business.address || "")
    .split("\n")
    .filter(Boolean)
  const clientAddressLines = String(client.address || "")
    .split("\n")
    .filter(Boolean)
  const businessName = business.name || "YOUR COMPANY NAME"
  const businessAddress =
    businessAddressLines[0] || "Your Address Line 1, Your Address Line 2"
  const businessCity =
    businessAddressLines.slice(1).join(", ") || "City, State - Pincode"
  const clientAddress = clientAddressLines[0] || ""
  const clientCity = clientAddressLines.slice(1).join(", ") || ""

  return (
    <article className="tax-invoice-template" id="invoice">
      <header className="tax-head">
        <h2>{businessName}</h2>
        <div className="tax-business-address">{businessAddress}</div>
        <div className="tax-business-address">{businessCity}</div>
        <div className="tax-contact-line">
          <span>Phone : {business.phone || "9876543210"}</span>
          <i />
          <span>E-Mail : {business.email || "info@yourcompany.com"}</span>
        </div>
      </header>

      <h3 className="tax-title">TAX INVOICE</h3>

      <section className="tax-party-grid">
        <div className="tax-bill-to">
          <h4>Bill To:</h4>
          <div className="tax-field-list">
            <div>
              <span>Name</span>
              <i>:</i>
              <strong>{client.name}</strong>
            </div>
            <div>
              <span>Address</span>
              <i>:</i>
              <strong>{clientAddress}</strong>
            </div>
            <div>
              <span>City, State</span>
              <i>:</i>
              <strong>{clientCity}</strong>
            </div>
            <div>
              <span>PIN/ZIP</span>
              <i>:</i>
              <strong />
            </div>
            <div>
              <span>GSTIN</span>
              <i>:</i>
              <strong>{client.gstNo}</strong>
            </div>
          </div>
        </div>
        <div className="tax-details">
          <div className="tax-field-list">
            <div>
              <span>Invoice No.</span>
              <i>:</i>
              <strong>{meta.number}</strong>
            </div>
            <div>
              <span>Date</span>
              <i>:</i>
              <strong>{formatDateLabel(meta.issueDate)}</strong>
            </div>
            <div>
              <span>L.R. No.</span>
              <i>:</i>
              <strong />
            </div>
            <div>
              <span>Cases</span>
              <i>:</i>
              <strong />
            </div>
            <div>
              <span>Transport</span>
              <i>:</i>
              <strong />
            </div>
            <div>
              <span>Due Date</span>
              <i>:</i>
              <strong>{formatDateLabel(meta.dueDate)}</strong>
            </div>
          </div>
        </div>
      </section>

      <table className="tax-items">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Qty.</th>
            <th>Product</th>
            <th>Rate</th>
            <th>DIS</th>
            <th>GST</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((it, index) => {
            const qty = Number(it.qty) || 0
            const price = Number(it.price) || 0
            const line = calc.lines.find((entry) => entry.id === it.id)

            return (
              <tr key={it.id}>
                <td>{index + 1}</td>
                <td>{qty}</td>
                <td>{it.description || "Item description"}</td>
                <td>{formatMoney(price)}</td>
                <td>{Number(it.discount) || 0}%</td>
                <td>{Number(it.taxRate) || 0}%</td>
                <td>{formatMoney(line?.total ?? 0)}</td>
              </tr>
            )
          })}
          {printableRows.map((_, index) => (
            <tr className="tax-empty-row" key={`empty-${index}`}>
              <td>{visibleItems.length + index + 1}</td>
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      <section className="tax-summary">
        <div className="tax-summary-space" />
        <div className="tax-summary-table">
          <div>
            <span>Sub Total</span>
            <strong>{formatMoney(calc.subtotal)}</strong>
          </div>
          <div>
            <span>GST</span>
            <strong>{formatMoney(calc.taxAmount)}</strong>
          </div>
          <div>
            <span>Round Off</span>
            <strong>{formatMoney(roundOff)}</strong>
          </div>
          <div className="tax-grand-total">
            <span>GRAND TOTAL</span>
            <strong>{formatMoney(roundedTotal)}</strong>
          </div>
        </div>
      </section>

      <section className="tax-terms">
        <div className="tax-terms-copy">
          <h4>Terms & Conditions</h4>
          <ul>
            <li>Goods once sold will not be taken back or exchanged.</li>
            <li>Bills not paid due date will attract 24% interest.</li>
            <li>All disputes subject to Jurisdiction only.</li>
            <li>Prescribed Sales Tax declaration will be given.</li>
          </ul>
        </div>
        <div className="tax-signature">
          <strong>For {businessName}</strong>
          <span>Authorised signatory</span>
        </div>
      </section>
    </article>
  )
}

function Panel({ title, children }) {
  return (
    <div className="panel">
      <div className="panel-label">{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children, full }) {
  return (
    <FormField className={`field${full ? " full" : ""}`}>
      <FieldLabel className="field-label">{label}</FieldLabel>
      {children}
    </FormField>
  )
}

/* ─── Icons ─────────────────────────────────────── */
function IconDownload() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v8m0 0l-3-3m3 3l3-3" />
      <path d="M2.5 12v1.5a1 1 0 001 1h9a1 1 0 001-1V12" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4.5h10M6.5 4.5V3.2a.7.7 0 01.7-.7h1.6a.7.7 0 01.7.7v1.3M5 4.5l.5 8a1 1 0 001 .9h3a1 1 0 001-.9l.5-8" />
    </svg>
  )
}

function IconReceipt() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2.5h8v11l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1v-11z" />
      <path d="M5.5 5h5M5.5 7.5h5M5.5 10h3" />
    </svg>
  )
}

function IconReplay() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 5.2A4.8 4.8 0 1 1 3.4 8" />
      <path d="M4.5 2.5v2.7h2.7" />
    </svg>
  )
}

function IconHome() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.4 7.3 8 2.8l5.6 4.5v5.4a.9.9 0 0 1-.9.9h-2.5V9.4H5.8v4.2H3.3a.9.9 0 0 1-.9-.9V7.3z" />
    </svg>
  )
}
