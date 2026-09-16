import { Schema, model, models, type InferSchemaType } from "mongoose"

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    sku: { type: String, required: true, trim: true, unique: true, index: true },
    price: { type: Number, required: true, min: 0 },
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

export const Product =
  models.Product || model("Product", productSchema)
