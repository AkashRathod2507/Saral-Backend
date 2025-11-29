import mongoose from 'mongoose';
const { Schema } = mongoose;

const productVariantSchema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  SKU: { type: String, required: true, unique: true, trim: true },
  price: {
    retail: { type: Number, required: true },
    wholesale: { type: Number }
  },
  stockQuantity: { type: Number, required: true, default: 0 },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
  options: { type: Schema.Types.Mixed }
}, { timestamps: true });

export const ProductVariant = mongoose.model('ProductVariant', productVariantSchema);








