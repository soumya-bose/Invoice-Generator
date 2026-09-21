import { Schema, model, models, type InferSchemaType } from "mongoose"

const invoiceItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    // Fix #8: min changed from 0 to 1 — zero-qty items produce $0 lines and skip stock
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, required: true, min: 0 },
    taxMode: {
      type: String,
      enum: ["exclusive", "inclusive"],
      default: "exclusive",
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
  },
  { _id: false }
)

const partySchema = new Schema(
  {
    name: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    zip: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    gstNo: { type: String, default: "", trim: true },
  },
  { _id: false }
)

// Fix #17: Added { timestamps: true } so updatedAt is tracked automatically.
// Removed manual createdAt field — Mongoose timestamps option handles it.
const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, trim: true, index: true },
    clientName: { type: String, required: true, trim: true },
    issueDate: { type: String, required: true },
    dueDate: { type: String, default: "" },
    currency: { type: String, required: true },
    business: { type: partySchema, default: {} },
    client: { type: partySchema, default: {} },
    items: { type: [invoiceItemSchema], default: [] },
    notes: { type: String, default: "" },
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
)

export type InvoiceDocument = InferSchemaType<typeof invoiceSchema> & {
  _id: unknown
}

export const Invoice =
  models.Invoice || model("Invoice", invoiceSchema)
