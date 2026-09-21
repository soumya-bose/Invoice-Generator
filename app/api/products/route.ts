import { Types } from "mongoose"
import { type NextRequest } from "next/server"

import { parseProductInput, serializeProduct } from "@/lib/inventory"
import { connectMongo, toApiError } from "@/lib/mongodb"
import { Product } from "@/models/Product"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    await connectMongo()

    const q = request.nextUrl.searchParams.get("q")?.trim()
    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1
    )
    const pageSize = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(
          request.nextUrl.searchParams.get("pageSize") || "10",
          10
        ) || 10
      )
    )
    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
            { sku: { $regex: q, $options: "i" } },
            { category: { $regex: q, $options: "i" } },
          ],
        }
      : {}

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      Product.countDocuments(filter),
    ])

    return Response.json({
      products: products.map(serializeProduct),
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
  try {
    await connectMongo()

    const parsed = parseProductInput(await request.json())
    if (!parsed.product) {
      return Response.json({ errors: parsed.errors }, { status: 400 })
    }

    const product = await Product.create(parsed.product)
    return Response.json({ product: serializeProduct(product) }, { status: 201 })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      return Response.json(
        { error: "A product with this SKU already exists" },
        { status: 409 }
      )
    }

    const { body, status } = toApiError(error)
    return Response.json(body, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter(
          (id: unknown) => typeof id === "string" && Types.ObjectId.isValid(id)
        )
      : []

    if (!ids.length) {
      return Response.json(
        { error: "No valid product IDs provided for deletion" },
        { status: 400 }
      )
    }

    if (!process.env.MONGODB_URI) {
      return Response.json({
        success: true,
        offline: true,
        deletedCount: ids.length,
        message: `${ids.length} product(s) deleted (offline mode)`,
      })
    }

    await connectMongo()

    const result = await Product.deleteMany({ _id: { $in: ids } })

    return Response.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} product(s) deleted successfully`,
    })
  } catch (error) {
    const { body, status } = toApiError(error)
    return Response.json(body, { status })
  }
}

