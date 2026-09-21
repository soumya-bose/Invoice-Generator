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
  name: "name",
  productname: "name",
  product: "name",
  itemname: "name",
  item: "name",
  title: "name",

  sku: "sku",
  code: "sku",
  productcode: "sku",
  itemcode: "sku",

  description: "description",
  desc: "description",
  details: "description",

  mrp: "mrp",
  maximumretailprice: "mrp",
  retailprice: "mrp",

  price: "price",
  sellingprice: "price",
  saleprice: "price",
  salesprice: "price",
  unitprice: "price",
  rate: "price",

  buy: "buyPrice",
  buyprice: "buyPrice",
  purchaseprice: "buyPrice",
  buyingprice: "buyPrice",
  cost: "buyPrice",
  costprice: "buyPrice",

  tax: "taxRate",
  taxrate: "taxRate",
  gst: "taxRate",
  gstrate: "taxRate",
  vat: "taxRate",

  stock: "stockQty",
  stockqty: "stockQty",
  stockquantity: "stockQty",
  qty: "stockQty",
  quantity: "stockQty",
  units: "stockQty",
  available: "stockQty",
  availablestock: "stockQty",

  category: "category",
  type: "category",
  group: "category",
}

const SAMPLE_PRODUCTS = [
  {
    "Product Name": "DOMS Aqua Colour Cakes 36 SHADES",
    SKU: "DOMS Aqua 36",
    Description: "36 shades watercolor cakes with nylon brush",
    MRP: 200,
    Price: 136,
    "Buy Price": 95,
    "Tax %": 18,
    Stock: 25,
    Category: "Stationery",
  },
  {
    "Product Name": "Desk Organizer",
    SKU: "STN-ORG-009",
    Description: "Multi-compartment organizer for desk supplies",
    MRP: 699,
    Price: 599,
    "Buy Price": 420,
    "Tax %": 12,
    Stock: 34,
    Category: "Stationery",
  },
  {
    "Product Name": "Office Ergonomic Chair",
    SKU: "EGR-CHR-006",
    Description: "High-back mesh ergonomic office chair",
    MRP: 10999,
    Price: 8999,
    "Buy Price": 6500,
    "Tax %": 18,
    Stock: 7,
    Category: "Furniture",
  },
  {
    "Product Name": "Consulting Hour",
    SKU: "SRV-CON-010",
    Description: "Professional consulting service",
    MRP: 3000,
    Price: 2500,
    "Buy Price": 1800,
    "Tax %": 18,
    Stock: 99,
    Category: "Services",
  },
]

export async function GET() {
  const worksheet = XLSX.utils.json_to_sheet(SAMPLE_PRODUCTS)
  worksheet["!cols"] = [
    { wch: 34 },
    { wch: 16 },
    { wch: 42 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory")
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": 'attachment; filename="inventory-import-sample.xlsx"',
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
        { returnDocument: "after", upsert: true, runValidators: true }
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
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "")
      const target = COLUMN_ALIASES[normalizedKey]
      if (target) acc[target] = value
      return acc
    },
    {}
  )
}
