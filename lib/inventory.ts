import { Types } from "mongoose"

import { Product, type ProductDocument } from "@/models/Product"

export type ApiProduct = {
  _id: string
  name: string
  description: string
  sku: string
  price: number
  taxRate: number
  stockQty: number
  category: string
  createdAt?: string
  updatedAt?: string
}

export type ProductInput = {
  name: string
  description: string
  sku: string
  price: number
  taxRate: number
  stockQty: number
  category: string
}

export type InvoiceItemInput = {
  description: string
  qty: number
  price: number
  discount?: number
  taxRate: number
  taxMode: "exclusive" | "inclusive"
  productId?: string
}

export function serializeProduct(product: ProductDocument): ApiProduct {
  const createdAt =
    product.createdAt instanceof Date ? product.createdAt.toISOString() : undefined
  const updatedAt =
    product.updatedAt instanceof Date ? product.updatedAt.toISOString() : undefined

  return {
    _id: String(product._id),
    name: product.name,
    description: product.description,
    sku: product.sku,
    price: product.price,
    taxRate: product.taxRate,
    stockQty: product.stockQty,
    category: product.category,
    createdAt,
    updatedAt,
  }
}

export function parseProductInput(value: unknown): {
  errors: string[]
  product?: ProductInput
} {
  const input = value && typeof value === "object" ? value : {}
  const record = input as Record<string, unknown>
  const product = {
    name: asString(record.name),
    description: asString(record.description),
    sku: asString(record.sku),
    price: asNumber(record.price),
    taxRate: asNumber(record.taxRate),
    stockQty: asNumber(record.stockQty),
    category: asString(record.category),
  }
  const errors: string[] = []

  if (!product.name) errors.push("name is required")
  if (!product.sku) errors.push("sku is required")
  if (!Number.isFinite(product.price) || product.price < 0) {
    errors.push("price must be a non-negative number")
  }
  if (!Number.isFinite(product.taxRate) || product.taxRate < 0) {
    errors.push("taxRate must be a non-negative number")
  }
  if (!Number.isFinite(product.stockQty) || product.stockQty < 0) {
    errors.push("stockQty must be a non-negative number")
  }

  return errors.length ? { errors } : { errors, product }
}

export function normalizeInvoiceItems(value: unknown): {
  errors: string[]
  items: InvoiceItemInput[]
} {
  if (!Array.isArray(value)) {
    return { errors: ["items must be an array"], items: [] }
  }

  const errors: string[] = []
  const items = value.map((item, index) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {}
    const taxMode = record.taxMode === "inclusive" ? "inclusive" : "exclusive"
    const normalized: InvoiceItemInput = {
      description: asString(record.description),
      qty: asNumber(record.qty),
      price: asNumber(record.price),
      discount: asNumber(record.discount),
      taxRate: asNumber(record.taxRate),
      taxMode,
      productId: asString(record.productId) || undefined,
    }

    if (!normalized.description) {
      errors.push(`Row ${index + 1}: description is required`)
    }
    if (!Number.isFinite(normalized.qty) || normalized.qty <= 0) {
      errors.push(`Row ${index + 1}: qty must be greater than zero`)
    }
    if (!Number.isFinite(normalized.price) || normalized.price < 0) {
      errors.push(`Row ${index + 1}: price must be a non-negative number`)
    }
    if (!Number.isFinite(normalized.taxRate) || normalized.taxRate < 0) {
      errors.push(`Row ${index + 1}: taxRate must be a non-negative number`)
    }
    if (normalized.productId && !Types.ObjectId.isValid(normalized.productId)) {
      errors.push(`Row ${index + 1}: productId is invalid`)
    }

    return normalized
  })

  return { errors, items }
}

export function buildStockRequirements(items: InvoiceItemInput[]) {
  const requirements = new Map<string, number>()

  items.forEach((item) => {
    if (!item.productId) return
    requirements.set(
      item.productId,
      (requirements.get(item.productId) ?? 0) + item.qty
    )
  })

  return requirements
}

export async function reserveStock(requirements: Map<string, number>) {
  const reserved: Array<{ productId: string; qty: number }> = []

  for (const [productId, qty] of requirements) {
    const product = await Product.findOneAndUpdate(
      {
        _id: productId,
        stockQty: { $gte: qty },
      },
      { $inc: { stockQty: -qty } },
      { new: true }
    )

    if (!product) {
      await rollbackStock(reserved)
      const current = await Product.findById(productId).lean()
      throw new Error(
        current
          ? `Insufficient stock for ${current.name}. Available: ${current.stockQty}`
          : "Selected product was not found"
      )
    }

    reserved.push({ productId, qty })
  }

  return reserved
}

export async function rollbackStock(
  reserved: Array<{ productId: string; qty: number }>
) {
  await Promise.all(
    reserved.map((entry) =>
      Product.findByIdAndUpdate(entry.productId, {
        $inc: { stockQty: entry.qty },
      })
    )
  )
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value)
  }
  return 0
}
