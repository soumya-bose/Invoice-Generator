import { Types } from "mongoose"

import { parseProductInput, serializeProduct } from "@/lib/inventory"
import { connectMongo, toApiError } from "@/lib/mongodb"
import { Product } from "@/models/Product"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectMongo()

    const { id } = await params
    if (!Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid product id" }, { status: 400 })
    }

    const parsed = parseProductInput(await request.json())
    if (!parsed.product) {
      return Response.json({ errors: parsed.errors }, { status: 400 })
    }

    const product = await Product.findByIdAndUpdate(id, parsed.product, {
      returnDocument: "after",
      runValidators: true,
    })

    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 })
    }

    return Response.json({ product: serializeProduct(product) })
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
