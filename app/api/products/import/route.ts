import * as XLSX from "xlsx"

import { parseProductInput } from "@/lib/inventory"
import { connectMongo, toApiError } from "@/lib/mongodb"
import { Product } from "@/models/Product"

export const runtime = "nodejs"

type ImportFailure = {
  row: number
  sku?: string
  errors: string[]
}

const COLUMN_ALIASES: Record<string, string> = {
  category: "category",
  description: "description",
  name: "name",
  price: "price",
  sku: "sku",
  stock: "stockQty",
  stockqty: "stockQty",
  stockquantity: "stockQty",
  tax: "taxRate",
  taxrate: "taxRate",
}

const SAMPLE_PRODUCTS = [
  {
    name: "Desk Organizer",
    sku: "STN-ORG-009",
    description: "Multi-compartment organizer for desk supplies",
    price: 599,
    taxRate: 12,
    stockQty: 34,
    category: "Stationery",
  },
  {
    name: "Consulting Hour",
    sku: "SRV-CON-010",
    description: "Professional consulting service",
    price: 2500,
    taxRate: 18,
    stockQty: 99,
    category: "Services",
  },
]

export async function GET() {
  const worksheet = XLSX.utils.json_to_sheet(SAMPLE_PRODUCTS)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products")
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": 'attachment; filename="product-import-sample.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  })
}

export async function POST(request: Request) {
  try {
    await connectMongo()

    const rows = await readRows(request)
    const failures: ImportFailure[] = []
    let inserted = 0
    let updated = 0

    for (const [index, rawRow] of rows.entries()) {
      const normalized = normalizeRow(rawRow)
      const parsed = parseProductInput(normalized)

      if (!parsed.product) {
        failures.push({
          row: index + 2,
          sku: normalized.sku ? String(normalized.sku) : undefined,
          errors: parsed.errors,
        })
        continue
      }

      const existing = await Product.exists({ sku: parsed.product.sku })
      await Product.findOneAndUpdate(
        { sku: parsed.product.sku },
        { $set: parsed.product },
        { new: true, upsert: true, runValidators: true }
      )

      if (existing) {
        updated += 1
      } else {
        inserted += 1
      }
    }

    return Response.json({
      inserted,
      updated,
      failed: failures.length,
      failures,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "No import file found") {
      return Response.json({ error: error.message }, { status: 400 })
    }

    const { body, status } = toApiError(error)
    return Response.json(body, { status })
  }
}

async function readRows(request: Request) {
  const contentType = request.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    const body = await request.json()
    return Array.isArray(body) ? body : Array.isArray(body.rows) ? body.rows : []
  }

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    throw new Error("No import file found")
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) return []

  const sheet = workbook.Sheets[firstSheetName]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  })
}

function normalizeRow(row: Record<string, unknown>) {
  return Object.entries(row).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      const normalizedKey = key.toLowerCase().replace(/[\s_-]/g, "")
      const target = COLUMN_ALIASES[normalizedKey]
      if (target) acc[target] = value
      return acc
    },
    {}
  )
}
