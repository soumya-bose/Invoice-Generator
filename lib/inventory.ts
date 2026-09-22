import { Types } from "mongoose"

import { Product, type ProductDocument } from "@/models/Product"

export type ApiProduct = {
  _id: string
  name: string
  description: string
  sku: string
  price: number
  buyPrice?: number
  mrp?: number
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
  buyPrice?: number
  mrp?: number
  taxRate: number
  stockQty: number
  category: string
}

export type InvoiceItemInput = {
  description: string
  qty: number
  price: number
  mrp?: number
  discount?: number
  taxRate: number
  taxMode: "exclusive" | "inclusive"
  itemType: "service" | "product"
  productId?: string
}

export function serializeProduct(product: ProductDocument): ApiProduct {
  const createdAt =
    product.createdAt instanceof Date
      ? product.createdAt.toISOString()
      : undefined
  const updatedAt =
    product.updatedAt instanceof Date
      ? product.updatedAt.toISOString()
      : undefined

  return {
    _id: String(product._id),
    name: product.name,
    description: product.description,
    sku: product.sku,
    price: product.price,
    // Fix #15: buyPrice is part of InferSchemaType — no double-cast needed
    buyPrice: typeof product.buyPrice === "number" ? product.buyPrice : 0,
    mrp: typeof product.mrp === "number" ? product.mrp : 0,
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
    buyPrice: asNumber(record.buyPrice ?? record.buy, 0),
    mrp: asNumber(record.mrp, 0),
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
  if (!Number.isFinite(product.buyPrice) || product.buyPrice < 0) {
    errors.push("buyPrice must be a non-negative number")
  }
  if (!Number.isFinite(product.mrp) || product.mrp < 0) {
    errors.push("mrp must be a non-negative number")
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
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {}
    const taxMode = record.taxMode === "inclusive" ? "inclusive" : "exclusive"
    const productId = asString(record.productId) || undefined
    const itemType =
      record.itemType === "product" || productId ? "product" : "service"
    const normalized: InvoiceItemInput = {
      description: asString(record.description),
      qty: asNumber(record.qty),
      price: asNumber(record.price),
      mrp: asNumber(record.mrp, 0),
      discount: asNumber(record.discount),
      taxRate: asNumber(record.taxRate),
      taxMode,
      itemType,
      productId,
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

export function buildStockRequirements(
  items: Array<{ productId?: unknown; qty?: unknown }>
) {
  const requirements = new Map<string, number>()

  items.forEach((item) => {
    if (!item?.productId) return
    const productId = String(item.productId).trim()
    if (!productId || productId === "undefined") return
    const qty = Number(item.qty) || 0
    if (qty <= 0) return

    requirements.set(productId, (requirements.get(productId) ?? 0) + qty)
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
      { returnDocument: "after" }
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

export async function restoreInvoiceStock(
  items: Array<{ productId?: unknown; qty?: unknown }>
) {
  const requirements = buildStockRequirements(items)
  const toRollback = Array.from(requirements.entries()).map(
    ([productId, qty]) => ({ productId, qty })
  )
  if (toRollback.length) {
    await rollbackStock(toRollback)
  }
}

export async function reconcileInvoiceStock(
  oldItems: Array<{ productId?: unknown; qty?: unknown }>,
  newItems: Array<{ productId?: unknown; qty?: unknown }>
) {
  const oldRequirements = buildStockRequirements(oldItems)
  const newRequirements = buildStockRequirements(newItems)

  const productIds = new Set([
    ...oldRequirements.keys(),
    ...newRequirements.keys(),
  ])

  const toReserve = new Map<string, number>()
  const toReturn: Array<{ productId: string; qty: number }> = []

  for (const productId of productIds) {
    const oldQty = oldRequirements.get(productId) || 0
    const newQty = newRequirements.get(productId) || 0
    const diff = newQty - oldQty

    if (diff > 0) {
      toReserve.set(productId, diff)
    } else if (diff < 0) {
      toReturn.push({ productId, qty: Math.abs(diff) })
    }
  }

  // Restore returned stock
  if (toReturn.length) {
    await rollbackStock(toReturn)
  }

  // Reserve additional stock
  if (toReserve.size) {
    try {
      await reserveStock(toReserve)
    } catch (reserveError) {
      // Revert returned stock so state is restored if reservation fails
      if (toReturn.length) {
        for (const ret of toReturn) {
          await Product.findByIdAndUpdate(ret.productId, {
            $inc: { stockQty: -ret.qty },
          })
        }
      }
      throw reserveError
    }
  }
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}
