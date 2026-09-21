import { Types } from "mongoose"
import {
  normalizeInvoiceItems,
  reconcileInvoiceStock,
  restoreInvoiceStock,
} from "@/lib/inventory"
import { connectMongo, MongoConfigurationError, toApiError } from "@/lib/mongodb"
import { Invoice } from "@/models/Invoice"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid invoice id" }, { status: 400 })
    }

    await connectMongo()
    const invoice = await Invoice.findById(id).lean()
    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 })
    }

    return Response.json({ invoice: serializeInvoice(invoice) })
  } catch (error) {
    const { body, status } = toApiError(error)
    return Response.json(body, { status })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!Types.ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid invoice id" }, { status: 400 })
  }

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

  // --- Offline fallback ---
  if (!process.env.MONGODB_URI) {
    return Response.json(
      {
        invoice: {
          _id: id,
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
          updatedAt: new Date().toISOString(),
        },
        offline: true,
      },
      { status: 200 }
    )
  }

  // --- MongoDB mode ---
  try {
    await connectMongo()

    const existingInvoice = await Invoice.findById(id)
    if (!existingInvoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Reconcile stock difference between old and new items
    await reconcileInvoiceStock(existingInvoice.items, items)

    existingInvoice.invoiceNumber = invoiceNumber
    existingInvoice.clientName = clientName
    existingInvoice.issueDate = issueDate
    existingInvoice.dueDate = asString(body.dueDate)
    existingInvoice.currency = currency
    existingInvoice.business = normalizeParty(body.business)
    existingInvoice.client = normalizeParty(body.client)
    existingInvoice.items = items as unknown as typeof existingInvoice.items
    existingInvoice.notes = asString(body.notes)
    existingInvoice.subtotal = asNumber(body.subtotal)
    existingInvoice.taxAmount = asNumber(body.taxAmount)
    existingInvoice.total = asNumber(body.total)

    await existingInvoice.save()

    return Response.json({
      invoice: serializeInvoice(existingInvoice),
      message: "Invoice updated successfully and inventory synchronized",
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("Insufficient stock")) {
      return Response.json({ error: error.message }, { status: 409 })
    }

    if (error instanceof MongoConfigurationError) {
      return Response.json(
        {
          invoice: {
            _id: id,
            invoiceNumber,
            updatedAt: new Date().toISOString(),
          },
          offline: true,
        },
        { status: 200 }
      )
    }

    const { body: errBody, status } = toApiError(error)
    return Response.json(errBody, { status })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!Types.ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid invoice id" }, { status: 400 })
  }

  if (!process.env.MONGODB_URI) {
    return Response.json({
      success: true,
      offline: true,
      message: "Invoice deleted (offline mode)",
    })
  }

  try {
    await connectMongo()

    const invoice = await Invoice.findById(id)
    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Restore stock for all products in this invoice
    await restoreInvoiceStock(invoice.items)

    await Invoice.findByIdAndDelete(id)

    return Response.json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} deleted and stock restored to inventory`,
    })
  } catch (error) {
    const { body, status } = toApiError(error)
    return Response.json(body, { status })
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
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {}

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
