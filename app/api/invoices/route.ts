import {
  buildStockRequirements,
  normalizeInvoiceItems,
  reserveStock,
  rollbackStock,
} from "@/lib/inventory"
import { connectMongo, MongoConfigurationError, toApiError } from "@/lib/mongodb"
import { Invoice } from "@/models/Invoice"
import { type NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    await connectMongo()

    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1
    )
    const pageSize = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(
          request.nextUrl.searchParams.get("pageSize") || "50",
          10
        ) || 50
      )
    )

    const [invoices, total] = await Promise.all([
      Invoice.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      Invoice.countDocuments({}),
    ])

    return Response.json({
      invoices: invoices.map(serializeInvoice),
      total,
      page,
      pageSize,
    })
  } catch (error) {
    const { body, status } = toApiError(error)
    return Response.json(body, { status })
  }
}

export async function POST(request: Request) {
  let reserved: Array<{ productId: string; qty: number }> = []

  const body = await request.json()
  const { errors, items } = normalizeInvoiceItems(body.items)

  if (errors.length) {
    return Response.json({ errors }, { status: 400 })
  }

  const invoiceNumber = asString(body.invoiceNumber)
  const clientName = asString(body.clientName)
  const issueDate = asString(body.issueDate)
  const currency = asString(body.currency)

  const invoiceErrors = [
    !invoiceNumber && "invoiceNumber is required",
    !clientName && "clientName is required",
    !issueDate && "issueDate is required",
    !currency && "currency is required",
  ].filter(Boolean)

  if (invoiceErrors.length) {
    return Response.json({ errors: invoiceErrors }, { status: 400 })
  }

  // --- No-database (offline) mode ---
  // If MONGODB_URI is not configured, skip DB operations and return a
  // synthetic success response so invoices can still be generated and printed.
  if (!process.env.MONGODB_URI) {
    const syntheticId = `local-${Date.now()}`
    return Response.json(
      {
        invoice: {
          _id: syntheticId,
          invoiceNumber,
          createdAt: new Date().toISOString(),
        },
        offline: true,
      },
      { status: 201 }
    )
  }

  // --- Full database mode ---
  try {
    await connectMongo()

    reserved = await reserveStock(buildStockRequirements(items))

    const invoice = await Invoice.create({
      invoiceNumber,
      clientName,
      issueDate,
      dueDate: asString(body.dueDate),
      currency,
      business: normalizeParty(body.business),
      client: normalizeParty(body.client),
      items,
      notes: asString(body.notes),
      subtotal: asNumber(body.subtotal),
      taxAmount: asNumber(body.taxAmount),
      total: asNumber(body.total),
    })

    return Response.json(
      {
        invoice: {
          ...serializeInvoice(invoice),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (reserved.length) {
      await rollbackStock(reserved)
    }

    if (error instanceof Error && error.message.includes("Insufficient stock")) {
      return Response.json({ error: error.message }, { status: 409 })
    }

    // Fallback: if DB connect fails at runtime, still allow invoice generation
    if (error instanceof MongoConfigurationError) {
      const syntheticId = `local-${Date.now()}`
      return Response.json(
        {
          invoice: {
            _id: syntheticId,
            invoiceNumber,
            createdAt: new Date().toISOString(),
          },
          offline: true,
        },
        { status: 201 }
      )
    }

    const { body: errBody, status } = toApiError(error)
    return Response.json(errBody, { status })
  }
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim() !== "") return Number(value)
  return 0
}

function normalizeParty(value: unknown) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {}

  return {
    name: asString(record.name),
    email: asString(record.email),
    address: asString(record.address),
    city: asString(record.city),
    state: asString(record.state),
    zip: asString(record.zip),
    phone: asString(record.phone),
    gstNo: asString(record.gstNo),
  }
}

function serializeInvoice(invoice: {
  _id: unknown
  invoiceNumber: string
  clientName: string
  issueDate: string
  dueDate?: string
  currency: string
  business?: Record<string, unknown>
  client?: Record<string, unknown>
  items?: unknown[]
  notes?: string
  subtotal: number
  taxAmount: number
  total: number
  createdAt?: Date
}) {
  return {
    _id: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate || "",
    currency: invoice.currency,
    business: invoice.business || {},
    client: invoice.client || {},
    items: invoice.items || [],
    notes: invoice.notes || "",
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    createdAt:
      invoice.createdAt instanceof Date
        ? invoice.createdAt.toISOString()
        : undefined,
  }
}
