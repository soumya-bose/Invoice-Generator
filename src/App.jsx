'use client'

import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { ReceiptPrinter } from '@/components/ReceiptPrinter'

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD — US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP — British Pound' },
  { code: 'TRY', symbol: '₺', label: 'TRY — Turkish Lira' },
  { code: 'JPY', symbol: '¥', label: 'JPY — Japanese Yen' },
  { code: 'CAD', symbol: '$', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', symbol: '$', label: 'AUD — Australian Dollar' },
  { code: 'INR', symbol: '₹', label: 'INR — Indian Rupee' },
]

const STORAGE_KEY = 'invoice-generator-v1'

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
  business: { name: '', email: '', address: '', phone: '' },
  client: { name: '', email: '', address: '' },
  meta: {
    number: 'INV-0001',
    issueDate: todayISO(),
    dueDate: plusDaysISO(14),
    currency: 'USD',
  },
  items: [
    { id: 'item-1', description: '', qty: 1, price: 0 },
  ],
  taxRate: 0,
  discount: 0,
  notes: 'Thank you for your business!',
}

const SAMPLE_STATE = {
  business: {
    name: 'Acme Studio',
    email: 'hello@acmestudio.com',
    address: '123 Market St, Suite 4\nSan Francisco, CA 94103',
    phone: '+1 (555) 018-2245',
  },
  client: {
    name: 'Nova Coffee Co.',
    email: 'billing@novacoffee.com',
    address: '456 Client Ave\nNew York, NY 10012',
  },
  meta: {
    number: 'INV-0042',
    issueDate: todayISO(),
    dueDate: plusDaysISO(14),
    currency: 'USD',
  },
  items: [
    { id: newId(), description: 'Brand identity & logo design', qty: 1, price: 1800 },
    { id: newId(), description: 'Website UI design (5 pages)', qty: 5, price: 320 },
    { id: newId(), description: 'Design revision rounds', qty: 3, price: 120 },
  ],
  taxRate: 8,
  discount: 5,
  notes: 'Payment due within 14 days via bank transfer.\nThank you for your business!',
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
          ? parsed.items.map((i) => ({ id: i.id || newId(), description: i.description || '', qty: i.qty ?? 1, price: i.price ?? 0 }))
          : DEFAULT_STATE.items,
    }
  } catch {
    return DEFAULT_STATE
  }
}

function formatMoney(value, currency) {
  const num = Number.isFinite(value) ? value : 0
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return num.toFixed(2)
  }
}

function formatDateLabel(iso) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}

export default function App() {
  const pathname = usePathname()
  const router = useRouter()
  const [state, setState] = useState(DEFAULT_STATE)
  const isLoaded = useRef(false)
  const [receiptStage, setReceiptStage] = useState(() => (pathname === '/invoice' ? 'complete' : 'processing'))
  const [showReceiptPrinter, setShowReceiptPrinter] = useState(() => pathname === '/invoice')
  const [invoiceGenerated, setInvoiceGenerated] = useState(() => pathname === '/invoice')
  const generationTimers = useRef([])

  const { business, client, meta, items, taxRate, discount, notes } = state
  const isInvoiceRoute = pathname === '/invoice'

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
    setReceiptStage('processing')
  }, [clearGenerationTimers])

  // ── field helpers ────────────────────────────────
  const setField = useCallback((section, key, value) => {
    markInvoiceDirty()
    setState((s) => ({ ...s, [section]: { ...s[section], [key]: value } }))
  }, [markInvoiceDirty])

  const setTop = useCallback((key, value) => {
    markInvoiceDirty()
    setState((s) => ({ ...s, [key]: value }))
  }, [markInvoiceDirty])

  const updateItem = useCallback((id, key, value) => {
    markInvoiceDirty()
    setState((s) => ({
      ...s,
      items: s.items.map((it) => (it.id === id ? { ...it, [key]: value } : it)),
    }))
  }, [markInvoiceDirty])

  const addItem = useCallback(() => {
    markInvoiceDirty()
    setState((s) => ({ ...s, items: [...s.items, { id: newId(), description: '', qty: 1, price: 0 }] }))
  }, [markInvoiceDirty])

  const removeItem = useCallback((id) => {
    markInvoiceDirty()
    setState((s) => ({ ...s, items: s.items.length > 1 ? s.items.filter((it) => it.id !== id) : s.items }))
  }, [markInvoiceDirty])

  const resetAll = useCallback(() => {
    markInvoiceDirty()
    const fresh = { ...DEFAULT_STATE, items: [{ id: newId(), description: '', qty: 1, price: 0 }], meta: { ...DEFAULT_STATE.meta, issueDate: todayISO(), dueDate: plusDaysISO(14) } }
    setState(fresh)
  }, [markInvoiceDirty])

  const loadSample = useCallback(() => {
    markInvoiceDirty()
    setState({
      ...SAMPLE_STATE,
      items: SAMPLE_STATE.items.map((it) => ({ ...it, id: newId() })),
      meta: { ...SAMPLE_STATE.meta, issueDate: todayISO(), dueDate: plusDaysISO(14) },
    })
  }, [markInvoiceDirty])

  // ── calculations ─────────────────────────────────
  const currency = meta.currency
  const currencyMeta = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0]

  const calc = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
    const discountAmount = subtotal * ((Number(discount) || 0) / 100)
    const taxable = subtotal - discountAmount
    const taxAmount = taxable * ((Number(taxRate) || 0) / 100)
    const total = taxable + taxAmount
    return { subtotal, discountAmount, taxable, taxAmount, total }
  }, [items, discount, taxRate])

  const handleGenerateInvoice = useCallback(() => {
    clearGenerationTimers()
    setInvoiceGenerated(false)
    setShowReceiptPrinter(true)
    setReceiptStage('processing')

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore quota errors */
    }

    const printingTimer = window.setTimeout(() => {
      setReceiptStage('printing')
    }, 500)

    const completeTimer = window.setTimeout(() => {
      setReceiptStage('complete')
      setInvoiceGenerated(true)
      router.push('/invoice')
    }, 4300)

    generationTimers.current = [printingTimer, completeTimer]
  }, [clearGenerationTimers, router, state])

  const handleReplayReceipt = useCallback(() => {
    clearGenerationTimers()
    setShowReceiptPrinter(true)
    setReceiptStage('processing')

    const printingTimer = window.setTimeout(() => {
      setReceiptStage('printing')
    }, 500)

    const completeTimer = window.setTimeout(() => {
      setReceiptStage('complete')
      setInvoiceGenerated(true)
    }, 4300)

    generationTimers.current = [printingTimer, completeTimer]
  }, [clearGenerationTimers])

  const handleEditInvoice = useCallback(() => {
    clearGenerationTimers()
    setShowReceiptPrinter(false)
    setInvoiceGenerated(false)
    setReceiptStage('processing')
    router.push('/')
  }, [clearGenerationTimers, router])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const isGenerating = showReceiptPrinter && !invoiceGenerated

  const isPrinterRunning = receiptStage !== 'complete'

  return (
    <div className="app">
      {/* Header */}
      <header className="header no-print">
        <div className="header-inner">
          <div className="header-left">
            <Image src="/images/receipt-printer-logo.svg" alt="" className="app-logo" width={34} height={34} priority />
            <div>
              <h1 className="header-title">Invoice Generator</h1>
              <p className="header-sub">Create clean, professional invoices in seconds</p>
            </div>
          </div>
          <div className="header-right">
            {isInvoiceRoute ? (
              <button className="btn-ghost" onClick={handleEditInvoice} aria-label="Edit invoice">Edit</button>
            ) : (
              <>
                <button className="btn-ghost" onClick={loadSample} aria-label="Load sample data">Sample</button>
                <button className="btn-ghost" onClick={resetAll} aria-label="Reset invoice">Reset</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="main">
        <div className={isInvoiceRoute ? 'invoice-view' : 'form-view'}>
          {/* ─── Editor ─────────────────────────── */}
          {!isInvoiceRoute && (
          <section className="editor no-print" aria-label="Invoice editor">
            <Panel title="Your Business">
              <div className="field-grid">
                <Field label="Business name" full>
                  <input className="in" value={business.name} onChange={(e) => setField('business', 'name', e.target.value)} placeholder="Acme Studio" aria-label="Business name" />
                </Field>
                <Field label="Email">
                  <input className="in" value={business.email} onChange={(e) => setField('business', 'email', e.target.value)} placeholder="hello@acme.com" aria-label="Business email" />
                </Field>
                <Field label="Phone">
                  <input className="in" value={business.phone} onChange={(e) => setField('business', 'phone', e.target.value)} placeholder="+1 555 000 0000" aria-label="Business phone" />
                </Field>
                <Field label="Address" full>
                  <textarea className="in ta" rows={2} value={business.address} onChange={(e) => setField('business', 'address', e.target.value)} placeholder="123 Market St, Suite 4&#10;San Francisco, CA" aria-label="Business address" />
                </Field>
              </div>
            </Panel>

            <Panel title="Bill To">
              <div className="field-grid">
                <Field label="Client name" full>
                  <input className="in" value={client.name} onChange={(e) => setField('client', 'name', e.target.value)} placeholder="Jane Client" aria-label="Client name" />
                </Field>
                <Field label="Email" full>
                  <input className="in" value={client.email} onChange={(e) => setField('client', 'email', e.target.value)} placeholder="jane@company.com" aria-label="Client email" />
                </Field>
                <Field label="Address" full>
                  <textarea className="in ta" rows={2} value={client.address} onChange={(e) => setField('client', 'address', e.target.value)} placeholder="456 Client Ave&#10;New York, NY" aria-label="Client address" />
                </Field>
              </div>
            </Panel>

            <Panel title="Invoice Details">
              <div className="field-grid">
                <Field label="Invoice #">
                  <input className="in" value={meta.number} onChange={(e) => setField('meta', 'number', e.target.value)} placeholder="INV-0001" aria-label="Invoice number" />
                </Field>
                <Field label="Currency">
                  <div className="select-wrap">
                    <select className="in select" value={meta.currency} onChange={(e) => setField('meta', 'currency', e.target.value)} aria-label="Currency">
                      {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </div>
                </Field>
                <Field label="Issue date">
                  <input type="date" className="in date" value={meta.issueDate} onChange={(e) => setField('meta', 'issueDate', e.target.value)} aria-label="Issue date" />
                </Field>
                <Field label="Due date">
                  <input type="date" className="in date" value={meta.dueDate} onChange={(e) => setField('meta', 'dueDate', e.target.value)} aria-label="Due date" />
                </Field>
              </div>
            </Panel>

            <Panel title="Line Items">
              <div className="items-editor">
                <div className="item-head">
                  <span className="ih-desc">Description</span>
                  <span className="ih-qty">Qty</span>
                  <span className="ih-price">Price</span>
                  <span className="ih-amt">Amount</span>
                  <span className="ih-del" />
                </div>
                {items.map((it) => {
                  const amount = (Number(it.qty) || 0) * (Number(it.price) || 0)
                  return (
                    <div className="item-row" key={it.id}>
                      <input className="in item-desc" value={it.description} onChange={(e) => updateItem(it.id, 'description', e.target.value)} placeholder="Design services" aria-label="Item description" />
                      <input className="in item-num" type="number" min="0" step="1" value={it.qty} onChange={(e) => updateItem(it.id, 'qty', e.target.value === '' ? '' : Number(e.target.value))} aria-label="Quantity" />
                      <input className="in item-num" type="number" min="0" step="0.01" value={it.price} onChange={(e) => updateItem(it.id, 'price', e.target.value === '' ? '' : Number(e.target.value))} aria-label="Unit price" />
                      <span className="item-amt">{formatMoney(amount, currency)}</span>
                      <button className="del-btn" onClick={() => removeItem(it.id)} disabled={items.length <= 1} aria-label="Remove item">
                        <IconTrash />
                      </button>
                    </div>
                  )
                })}
              </div>
              <button className="btn-add" onClick={addItem} aria-label="Add line item">
                <IconPlus /> Add item
              </button>
            </Panel>

            <Panel title="Totals & Notes">
              <div className="field-grid">
                <Field label="Discount (%)">
                  <input className="in" type="number" min="0" max="100" step="0.1" value={discount} onChange={(e) => setTop('discount', e.target.value === '' ? '' : Number(e.target.value))} aria-label="Discount percent" />
                </Field>
                <Field label="Tax (%)">
                  <input className="in" type="number" min="0" max="100" step="0.1" value={taxRate} onChange={(e) => setTop('taxRate', e.target.value === '' ? '' : Number(e.target.value))} aria-label="Tax percent" />
                </Field>
                <Field label="Notes" full>
                  <textarea className="in ta" rows={2} value={notes} onChange={(e) => setTop('notes', e.target.value)} placeholder="Payment terms, thank-you note…" aria-label="Notes" />
                </Field>
              </div>
            </Panel>

            <div className="generate-actions">
              <button className="btn-primary btn-generate" onClick={handleGenerateInvoice} disabled={isGenerating} aria-label="Generate invoice">
                <IconReceipt /> {isGenerating ? 'Generating...' : 'Generate Invoice'}
              </button>
            </div>
          </section>
          )}

          {/* ─── Preview ────────────────────────── */}
          {!isInvoiceRoute && showReceiptPrinter && (
          <section className="generation-overlay" aria-label="Generating invoice">
            {showReceiptPrinter && (
              <ReceiptPrinter.Root stage={receiptStage} className="checkout-printer">
                <ReceiptPrinter.Machine>
                  <ReceiptPrinter.Header>
                    <div className="receipt-logo" aria-hidden="true">
                      <Image src="/images/receipt-printer-logo.svg" alt="" width={34} height={34} />
                    </div>
                    <button className="receipt-home" type="button" onClick={() => router.push('/')}>
                      <IconHome /> Home
                    </button>
                  </ReceiptPrinter.Header>

                  <ReceiptPrinter.Screen>
                    <div className="receipt-screen-row">
                      <div>
                        <p>{items[0]?.description || 'Invoice'}</p>
                        <span>{client.name || 'Generated invoice'}</span>
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
                      <Image src="/images/receipt-printer-logo.svg" alt="" width={40} height={40} />
                    </div>
                    <div className="receipt-paper-title">{items[0]?.description || 'Invoice'}</div>
                    <div className="receipt-paper-meta">
                      <span>{meta.number || 'Invoice'}</span>
                      <span>{formatDateLabel(meta.issueDate)}</span>
                    </div>
                    <div className="receipt-paper-rule" />
                    <div className="receipt-paper-parties">
                      <span>Paid to</span>
                      <strong>{business.name || 'Your Business'}</strong>
                      <span>Paid by</span>
                      <strong>{client.name || 'Client name'}</strong>
                    </div>
                    <div className="receipt-paper-items">
                      {items.map((it) => (
                        <div className="receipt-line" key={it.id}>
                          <span>{it.description || 'Item description'}</span>
                          <strong>{formatMoney((Number(it.qty) || 0) * (Number(it.price) || 0), currency)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="receipt-paper-rule" />
                    <div className="receipt-line">
                      <span>Subtotal</span>
                      <strong>{formatMoney(calc.subtotal, currency)}</strong>
                    </div>
                    {(Number(discount) || 0) > 0 && (
                      <div className="receipt-line">
                        <span>Discount</span>
                        <strong>-{formatMoney(calc.discountAmount, currency)}</strong>
                      </div>
                    )}
                    {(Number(taxRate) || 0) > 0 && (
                      <div className="receipt-line">
                        <span>Tax</span>
                        <strong>{formatMoney(calc.taxAmount, currency)}</strong>
                      </div>
                    )}
                    <div className="receipt-line receipt-total">
                      <span>Total paid</span>
                      <strong>{formatMoney(calc.total, currency)}</strong>
                    </div>
                    <div className="receipt-paper-rule" />
                    <div className="receipt-transaction">
                      <div><span>Order</span><strong>{meta.number || 'INV-0001'}</strong></div>
                      <div><span>Paid with</span><strong>Visa **** 4242</strong></div>
                      <div><span>Date</span><strong>{formatDateLabel(meta.issueDate)}</strong></div>
                    </div>
                    <div className="receipt-barcode" aria-hidden="true">
                      {Array.from({ length: 52 }, (_, index) => <span key={index} />)}
                    </div>
                    <p className="receipt-thanks">Thanks for your business.</p>
                  </ReceiptPrinter.Paper>
                </ReceiptPrinter.Output>
              </ReceiptPrinter.Root>
            )}
          </section>
          )}

          {isInvoiceRoute && (
          <section className="preview-wrap is-ready" aria-label="Generated invoice">
            <ReceiptPrinter.Root stage={receiptStage} className="checkout-printer generated-printer no-print">
              <ReceiptPrinter.Machine>
                <ReceiptPrinter.Header>
                  <div className="receipt-logo" aria-hidden="true">
                    <Image src="/images/receipt-printer-logo.svg" alt="" width={34} height={34} />
                  </div>
                  <button className="receipt-home" type="button" onClick={handleEditInvoice}>
                    <IconHome /> Home
                  </button>
                </ReceiptPrinter.Header>

                <ReceiptPrinter.Screen>
                  <div className="receipt-screen-row">
                    <div>
                      <p>{items[0]?.description || 'Invoice'}</p>
                      <span>{client.name || 'Generated invoice'}</span>
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
                    <Image src="/images/receipt-printer-logo.svg" alt="" width={40} height={40} />
                  </div>
                  <div className="receipt-paper-title">{items[0]?.description || 'Invoice'}</div>
                  <div className="receipt-paper-meta">
                    <span>{meta.number || 'Invoice'}</span>
                    <span>{formatDateLabel(meta.issueDate)}</span>
                  </div>
                  <div className="receipt-paper-rule" />
                  <div className="receipt-paper-parties">
                    <span>Paid to</span>
                    <strong>{business.name || 'Your Business'}</strong>
                    <span>Paid by</span>
                    <strong>{client.name || 'Client name'}</strong>
                  </div>
                  <div className="receipt-paper-items">
                    {items.map((it) => (
                      <div className="receipt-line" key={it.id}>
                        <span>{it.description || 'Item description'}</span>
                        <strong>{formatMoney((Number(it.qty) || 0) * (Number(it.price) || 0), currency)}</strong>
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
                    <div><span>Order</span><strong>{meta.number || 'INV-0001'}</strong></div>
                    <div><span>Paid with</span><strong>Visa **** 4242</strong></div>
                    <div><span>Date</span><strong>{formatDateLabel(meta.issueDate)}</strong></div>
                  </div>
                  <div className="receipt-barcode" aria-hidden="true">
                    {Array.from({ length: 52 }, (_, index) => <span key={index} />)}
                  </div>
                  <p className="receipt-thanks">Thanks for your business.</p>
                </ReceiptPrinter.Paper>
              </ReceiptPrinter.Output>
            </ReceiptPrinter.Root>

            <div className="invoice-result">
              <div className="invoice-result-actions no-print">
                <button className="btn-ghost btn-replay" onClick={handleReplayReceipt} disabled={isPrinterRunning} aria-label="Replay receipt generation">
                  <IconReplay /> {isPrinterRunning ? 'Replaying' : 'Replay'}
                </button>
                <button className="btn-primary btn-download" onClick={handlePrint} aria-label="Download invoice as PDF">
                  <IconDownload /> Download PDF
                </button>
              </div>

              <TaxInvoiceDocument
                business={business}
                calc={calc}
                client={client}
                discount={discount}
                formatMoney={(value) => formatMoney(value, currency)}
                items={items}
                meta={meta}
                notes={notes}
                taxRate={taxRate}
              />

              <div className="invoice-paper legacy-invoice-paper">
              <div className="inv-top">
                <div className="inv-brand">
                  <div className="inv-brand-name">{business.name || 'Your Business'}</div>
                  <div className="inv-brand-meta">
                    {business.email && <div>{business.email}</div>}
                    {business.phone && <div>{business.phone}</div>}
                    {business.address && <div className="inv-multiline">{business.address}</div>}
                  </div>
                </div>
                <div className="inv-title-block">
                  <div className="inv-title">INVOICE</div>
                  <div className="inv-number">{meta.number || '—'}</div>
                </div>
              </div>

              <div className="inv-parties">
                <div className="inv-party">
                  <div className="inv-party-label">Bill To</div>
                  <div className="inv-party-name">{client.name || 'Client name'}</div>
                  <div className="inv-party-meta">
                    {client.email && <div>{client.email}</div>}
                    {client.address && <div className="inv-multiline">{client.address}</div>}
                  </div>
                </div>
                <div className="inv-dates">
                  <div className="inv-date-row"><span>Issue date</span><strong>{formatDateLabel(meta.issueDate)}</strong></div>
                  <div className="inv-date-row"><span>Due date</span><strong>{formatDateLabel(meta.dueDate)}</strong></div>
                  <div className="inv-date-row total-due"><span>Amount due</span><strong>{formatMoney(calc.total, currency)}</strong></div>
                </div>
              </div>

              <table className="inv-table">
                <thead>
                  <tr>
                    <th className="t-desc">Description</th>
                    <th className="t-qty">Qty</th>
                    <th className="t-price">Price</th>
                    <th className="t-amt">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="t-desc">{it.description || <span className="t-empty">Item description</span>}</td>
                      <td className="t-qty">{Number(it.qty) || 0}</td>
                      <td className="t-price">{formatMoney(Number(it.price) || 0, currency)}</td>
                      <td className="t-amt">{formatMoney((Number(it.qty) || 0) * (Number(it.price) || 0), currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="inv-summary">
                <div className="inv-sum-inner">
                  <div className="sum-row"><span>Subtotal</span><span>{formatMoney(calc.subtotal, currency)}</span></div>
                  {(Number(discount) || 0) > 0 && (
                    <div className="sum-row"><span>Discount ({discount}%)</span><span>−{formatMoney(calc.discountAmount, currency)}</span></div>
                  )}
                  {(Number(taxRate) || 0) > 0 && (
                    <div className="sum-row"><span>Tax ({taxRate}%)</span><span>{formatMoney(calc.taxAmount, currency)}</span></div>
                  )}
                  <div className="sum-row grand"><span>Total</span><span>{formatMoney(calc.total, currency)}</span></div>
                </div>
              </div>

              {notes && (
                <div className="inv-notes">
                  <div className="inv-notes-label">Notes</div>
                  <div className="inv-notes-text">{notes}</div>
                </div>
              )}

              <div className="inv-foot">Generated with Invoice Generator · {currencyMeta.code}</div>
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
function TaxInvoiceDocument({ business, calc, client, discount, formatMoney, items, meta, notes, taxRate }) {
  const businessAddress = business.address || '5 Any Street, Any City, That Area Code'
  const clientAddress = client.address || 'This Address\nThis City\nThis Area Code'
  const taxNumber = String(meta.number || '0003521').replace(/\D/g, '').slice(-6).padStart(6, '0')

  return (
    <article className="tax-invoice-template" id="invoice">
      <header className="tax-head">
        <h2>{business.name || 'TOM GREEN HANDYMAN'}</h2>
        <div className="tax-business-address inv-multiline">{businessAddress}</div>
        <strong>Telephone: {business.phone || '0800 XXX XXX'}</strong>
      </header>

      <section className="tax-meta-grid">
        <div><strong>Date :</strong><span>{meta.issueDate || todayISO()}</span></div>
        <div><strong>Invoice No :</strong><span>{taxNumber}</span></div>
        <div className="tax-registered"><strong>Tax Registered No</strong><span>{taxNumber}</span></div>
      </section>

      <section className="tax-client">
        <strong>{client.name || 'Mr and Mrs Fielding'}</strong>
        <div className="inv-multiline">{clientAddress}</div>
      </section>

      <h3 className="tax-title">TAX INVOICE</h3>

      <table className="tax-items">
        <thead>
          <tr>
            <th>Quantity</th>
            <th>Description</th>
            <th>Unit Price</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          {business.name && (
            <tr className="tax-job-row">
              <td />
              <td>{business.name}</td>
              <td />
              <td />
            </tr>
          )}
          {items.map((it) => {
            const qty = Number(it.qty) || 0
            const price = Number(it.price) || 0

            return (
              <tr key={it.id}>
                <td>{qty}</td>
                <td>{it.description || 'Item description'}</td>
                <td>{formatMoney(price)}</td>
                <td>{formatMoney(qty * price)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <section className="tax-totals">
        <div><span>Subtotal</span><strong>{formatMoney(calc.subtotal)}</strong></div>
        {(Number(discount) || 0) > 0 && <div><span>Discount</span><strong>-{formatMoney(calc.discountAmount)}</strong></div>}
        <div><span>Tax{Number(taxRate) ? ` (${taxRate}%)` : ''}</span><strong>{formatMoney(calc.taxAmount)}</strong></div>
        <div className="tax-total-due"><span>Total Due</span><strong>{formatMoney(calc.total)}</strong></div>
      </section>

      <section className="tax-terms">
        <p>Payment due by the 10th of the month following the date of invoice.</p>
        <p>Please make payment into Bank Account No. <strong>12 3456 789112 012</strong></p>
        <p>{notes || 'Interest of 10% per year will be charged on late payments.'}</p>
      </section>

      <section className="tax-remittance">
        <div className="tax-cut">Cut here</div>
        <h4>Remittance</h4>
        <div className="tax-remittance-grid">
          <div>
            <strong>{business.name || 'TOM GREEN HANDYMAN'}</strong>
            <div className="inv-multiline">{businessAddress}</div>
          </div>
          <div>
            <strong>{client.name || 'Mr and Mrs Fielding'}</strong>
            <div className="tax-remittance-row"><span>Amount Due</span><strong>{formatMoney(calc.total)}</strong></div>
            <div className="tax-remittance-row"><span>Amount Paid</span><i /></div>
          </div>
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
    <label className={`field${full ? ' full' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

/* ─── Icons ─────────────────────────────────────── */
function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8m0 0l-3-3m3 3l3-3" />
      <path d="M2.5 12v1.5a1 1 0 001 1h9a1 1 0 001-1V12" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5h10M6.5 4.5V3.2a.7.7 0 01.7-.7h1.6a.7.7 0 01.7.7v1.3M5 4.5l.5 8a1 1 0 001 .9h3a1 1 0 001-.9l.5-8" />
    </svg>
  )
}

function IconReceipt() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2.5h8v11l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1v-11z" />
      <path d="M5.5 5h5M5.5 7.5h5M5.5 10h3" />
    </svg>
  )
}

function IconReplay() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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
