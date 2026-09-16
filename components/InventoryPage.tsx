"use client"

import Image from "next/image"
import Link from "next/link"
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  BoxesIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  RefreshCcwIcon,
  SaveIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Product = {
  _id: string
  name: string
  description: string
  sku: string
  price: number
  taxRate: number
  stockQty: number
  category: string
}

type ProductForm = Omit<Product, "_id">

type ImportSummary = {
  inserted: number
  updated: number
  failed: number
}

const PAGE_SIZE = 10

const EMPTY_FORM: ProductForm = {
  name: "",
  description: "",
  sku: "",
  price: 0,
  taxRate: 0,
  stockQty: 0,
  category: "",
}

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [importing, setImporting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const totals = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        acc.units += Number(product.stockQty) || 0
        acc.value +=
          (Number(product.stockQty) || 0) * (Number(product.price) || 0)
        if ((Number(product.stockQty) || 0) <= 0) acc.out += 1
        return acc
      },
      { units: 0, value: 0, out: 0 }
    )
  }, [products])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (query.trim()) params.set("q", query.trim())

      const response = await fetch(`/api/products?${params.toString()}`)
      const data = (await response.json().catch(() => null)) as {
        products?: Product[]
        total?: number
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load products")
      }

      setProducts(Array.isArray(data?.products) ? data.products : [])
      setTotalProducts(Number(data?.total) || 0)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load products"
      )
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadProducts])

  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE))
  const firstVisibleProduct = totalProducts ? (page - 1) * PAGE_SIZE + 1 : 0
  const lastVisibleProduct = Math.min(page * PAGE_SIZE, totalProducts)

  const setFormField = useCallback(
    <Key extends keyof ProductForm>(key: Key, value: ProductForm[Key]) => {
      setForm((current) => ({ ...current, [key]: value }))
      setMessage("")
      setError("")
    },
    []
  )

  const startCreate = useCallback(() => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setMessage("")
    setError("")
  }, [])

  const startEdit = useCallback((product: Product) => {
    setEditingId(product._id)
    setForm({
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: product.price,
      taxRate: product.taxRate,
      stockQty: product.stockQty,
      category: product.category,
    })
    setMessage("")
    setError("")
  }, [])

  const saveProduct = useCallback(async () => {
    setSaving(true)
    setError("")
    setMessage("")

    try {
      const response = await fetch(
        editingId ? `/api/products/${editingId}` : "/api/products",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      )
      const data = (await response.json().catch(() => null)) as {
        product?: Product
        error?: string
        errors?: string[]
      } | null

      if (!response.ok || !data?.product) {
        throw new Error(
          data?.error || data?.errors?.join(", ") || "Unable to save product"
        )
      }

      const savedProduct = data.product

      setProducts((current) => {
        const exists = current.some(
          (product) => product._id === savedProduct._id
        )
        if (exists) {
          return current.map((product) =>
            product._id === savedProduct._id ? savedProduct : product
          )
        }
        return [savedProduct, ...current]
      })
      if (!editingId) setTotalProducts((current) => current + 1)
      setEditingId(savedProduct._id)
      setMessage(editingId ? "Product updated" : "Product created")
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save product"
      )
    } finally {
      setSaving(false)
    }
  }, [editingId, form])

  const updateStock = useCallback(
    async (product: Product, delta: number) => {
      setError("")
      setMessage("")

      try {
        const response = await fetch(`/api/products/${product._id}/stock`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delta }),
        })
        const data = (await response.json().catch(() => null)) as {
          product?: Product
          error?: string
        } | null

        if (!response.ok || !data?.product) {
          throw new Error(data?.error || "Unable to update stock")
        }

        setProducts((current) =>
          current.map((entry) =>
            entry._id === product._id ? (data.product as Product) : entry
          )
        )
        if (editingId === product._id) {
          setForm((current) => ({
            ...current,
            stockQty: data.product?.stockQty ?? current.stockQty,
          }))
        }
      } catch (stockError) {
        setError(
          stockError instanceof Error
            ? stockError.message
            : "Unable to update stock"
        )
      }
    },
    [editingId]
  )

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setImporting(true)
      setImportSummary(null)
      setError("")
      setMessage("")

      try {
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/products/import", {
          method: "POST",
          body: formData,
        })
        const data = (await response.json().catch(() => null)) as
          (ImportSummary & { error?: string }) | null

        if (!response.ok) {
          throw new Error(data?.error || "Product import failed")
        }

        setImportSummary({
          inserted: Number(data?.inserted) || 0,
          updated: Number(data?.updated) || 0,
          failed: Number(data?.failed) || 0,
        })
        await loadProducts()
      } catch (importError) {
        setError(
          importError instanceof Error
            ? importError.message
            : "Product import failed"
        )
      } finally {
        setImporting(false)
        event.target.value = ""
      }
    },
    [loadProducts]
  )

  const seedDemoProducts = useCallback(async () => {
    setSeeding(true)
    setImportSummary(null)
    setError("")
    setMessage("")

    try {
      const response = await fetch("/api/products/seed", {
        method: "POST",
      })
      const data = (await response.json().catch(() => null)) as
        (ImportSummary & { error?: string }) | null

      if (!response.ok) {
        throw new Error(data?.error || "Unable to add demo products")
      }

      setImportSummary({
        inserted: Number(data?.inserted) || 0,
        updated: Number(data?.updated) || 0,
        failed: Number(data?.failed) || 0,
      })
      await loadProducts()
    } catch (seedError) {
      setError(
        seedError instanceof Error
          ? seedError.message
          : "Unable to add demo products"
      )
    } finally {
      setSeeding(false)
    }
  }, [loadProducts])

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
              <h1 className="header-title">Inventory</h1>
              <p className="header-sub">MongoDB product catalog</p>
            </div>
          </div>
          <div className="header-right">
            <Link className="btn-ghost" href="/">
              Invoice
            </Link>
            <Button className="btn-ghost" onClick={loadProducts}>
              <RefreshCcwIcon aria-hidden="true" /> Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="main inventory-main">
        <section className="inventory-toolbar" aria-label="Inventory summary">
          <div>
            <span>Products</span>
            <strong>{totalProducts}</strong>
          </div>
          <div>
            <span>Units</span>
            <strong>{totals.units}</strong>
          </div>
          <div>
            <span>Value</span>
            <strong>{formatMoney(totals.value)}</strong>
          </div>
          <div>
            <span>Out</span>
            <strong>{totals.out}</strong>
          </div>
        </section>

        <div className="inventory-layout">
          <section
            className="panel inventory-form-panel"
            aria-label="Product form"
          >
            <div className="inventory-panel-head">
              <div className="panel-label">
                {editingId ? "Edit Product" : "New Product"}
              </div>
              <Button className="btn-ghost" onClick={startCreate}>
                <PlusIcon aria-hidden="true" /> New
              </Button>
            </div>

            <div className="inventory-form">
              <label className="field">
                <span className="field-label">Name</span>
                <Input
                  className="in"
                  value={form.name}
                  onChange={(event) => setFormField("name", event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">SKU</span>
                <Input
                  className="in"
                  value={form.sku}
                  onChange={(event) => setFormField("sku", event.target.value)}
                />
              </label>
              <label className="field full">
                <span className="field-label">Description</span>
                <Textarea
                  className="in ta"
                  rows={2}
                  value={form.description}
                  onChange={(event) =>
                    setFormField("description", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Price</span>
                <Input
                  className="in"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) =>
                    setFormField("price", Number(event.target.value))
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Tax %</span>
                <Input
                  className="in"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.taxRate}
                  onChange={(event) =>
                    setFormField("taxRate", Number(event.target.value))
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Stock</span>
                <Input
                  className="in"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stockQty}
                  onChange={(event) =>
                    setFormField("stockQty", Number(event.target.value))
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Category</span>
                <Input
                  className="in"
                  value={form.category}
                  onChange={(event) =>
                    setFormField("category", event.target.value)
                  }
                  placeholder="Category"
                />
              </label>
            </div>

            <div className="inventory-actions">
              <Button
                className="btn-primary"
                onClick={saveProduct}
                disabled={saving}
              >
                <SaveIcon aria-hidden="true" /> {saving ? "Saving" : "Save"}
              </Button>
              <input
                ref={importInputRef}
                className="sr-only"
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleImport}
              />
              <Button
                className="btn-import"
                variant="outline"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
              >
                <UploadIcon aria-hidden="true" />{" "}
                {importing ? "Importing" : "Import"}
              </Button>
              <Button
                className="btn-import"
                variant="outline"
                onClick={seedDemoProducts}
                disabled={seeding}
              >
                <BoxesIcon aria-hidden="true" />{" "}
                {seeding ? "Adding" : "Demo products"}
              </Button>
            </div>

            {message && (
              <div className="inventory-status">
                <CheckIcon aria-hidden="true" /> {message}
              </div>
            )}
            {importSummary && (
              <div className="inventory-status">
                <UploadIcon aria-hidden="true" />
                {importSummary.inserted} inserted, {importSummary.updated}{" "}
                updated, {importSummary.failed} failed
              </div>
            )}
            {error && (
              <div className="inventory-status is-error" role="alert">
                {error}
              </div>
            )}
          </section>

          <section className="panel inventory-list-panel" aria-label="Products">
            <div className="inventory-list-head">
              <div className="inventory-list-heading desktop-only">
                <div>
                  <span className="inventory-kicker">Catalog</span>
                  <h2>Product library</h2>
                </div>
                <span className="inventory-list-count">
                  {totalProducts
                    ? `${firstVisibleProduct}-${lastVisibleProduct} of ${totalProducts}`
                    : "0 products"}
                </span>
              </div>
              <div className="inventory-search">
                <SearchIcon aria-hidden="true" />
                <Input
                  className="in"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Search products"
                />
              </div>
            </div>

            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Price</th>
                    <th>Tax</th>
                    <th>Stock</th>
                    <th>Adjust</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7}>Loading inventory...</td>
                    </tr>
                  ) : products.length ? (
                    products.map((product) => (
                      <tr key={product._id}>
                        <td>
                          <strong>{product.name}</strong>
                          <span>{product.category || product.description}</span>
                        </td>
                        <td>{product.sku}</td>
                        <td>{formatMoney(product.price)}</td>
                        <td>{product.taxRate}%</td>
                        <td>
                          <span
                            className={
                              product.stockQty <= 0
                                ? "stock-pill is-empty"
                                : "stock-pill"
                            }
                          >
                            {product.stockQty}
                          </span>
                        </td>
                        <td>
                          <div className="stock-stepper">
                            <Button
                              className="stock-step"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => updateStock(product, -1)}
                              disabled={product.stockQty <= 0}
                              aria-label={`Reduce ${product.name} stock`}
                            >
                              -
                            </Button>
                            <Button
                              className="stock-step"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => updateStock(product, 1)}
                              aria-label={`Increase ${product.name} stock`}
                            >
                              +
                            </Button>
                          </div>
                        </td>
                        <td>
                          <Button
                            className="stock-step"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => startEdit(product)}
                            aria-label={`Edit ${product.name}`}
                          >
                            <PencilIcon aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <span className="inventory-empty">
                          <BoxesIcon aria-hidden="true" /> No products found
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <nav className="inventory-pagination" aria-label="Product pages">
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
        </div>
      </main>
    </div>
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}
