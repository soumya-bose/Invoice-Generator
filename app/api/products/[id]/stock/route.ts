import { Types } from "mongoose"

import { serializeProduct } from "@/lib/inventory"
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

    const body = await request.json()
    const update =
      typeof body.delta === "number"
        ? { $inc: { stockQty: body.delta } }
        : { $set: { stockQty: Number(body.stockQty) } }

    const product = await Product.findOneAndUpdate(
      {
        _id: id,
        ...(typeof body.delta === "number" && body.delta < 0
          ? { stockQty: { $gte: Math.abs(body.delta) } }
          : {}),
      },
      update,
      { returnDocument: "after", runValidators: true }
    )

    if (!product) {
      return Response.json(
        { error: "Product not found or insufficient stock" },
        { status: 404 }
      )
    }

    return Response.json({ product: serializeProduct(product) })
  } catch (error) {
    const { body, status } = toApiError(error)
    return Response.json(body, { status })
  }
}
