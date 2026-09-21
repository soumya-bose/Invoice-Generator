import { Schema, model, models, type InferSchemaType } from "mongoose"

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    sku: { type: String, required: true, trim: true, unique: true, index: true },
    price: { type: Number, required: true, min: 0 },
    buyPrice: { type: Number, default: 0, min: 0 },
    mrp: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, required: true, min: 0 },
    stockQty: { type: Number, required: true, min: 0 },
    category: { type: String, default: "", trim: true },
  },
  { timestamps: true }
)

productSchema.index({ name: "text", description: "text", sku: "text" })

export type ProductDocument = InferSchemaType<typeof productSchema> & {
  _id: unknown
}

// Fix #22: Hot-reload guard — in Next.js dev mode, modules can be re-evaluated
// without clearing Mongoose's model registry. We force re-registration if the
// cached model is missing known schema fields (e.g. buyPrice, added post-launch).
// ⚠️ Update this condition whenever new required fields are added to productSchema.
if (
  models.Product &&
  (!models.Product.schema.path("buyPrice") ||
    !models.Product.schema.path("mrp"))
) {
  delete (models as Record<string, unknown>).Product
}

export const Product =
  models.Product || model("Product", productSchema)
