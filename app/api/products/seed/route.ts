import { DEMO_PRODUCTS } from "@/lib/demo-products"
import { connectMongo, toApiError } from "@/lib/mongodb"
import { Product } from "@/models/Product"

export const runtime = "nodejs"

export async function POST() {
  try {
    await connectMongo()

    let inserted = 0
    let updated = 0

    for (const product of DEMO_PRODUCTS) {
      const existing = await Product.exists({ sku: product.sku })
      await Product.findOneAndUpdate(
        { sku: product.sku },
        { $set: product },
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
      failed: 0,
      products: DEMO_PRODUCTS.length,
    })
  } catch (error) {
    const { body, status } = toApiError(error)
    return Response.json(body, { status })
  }
}
