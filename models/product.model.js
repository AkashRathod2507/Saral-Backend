import mongoose from 'mongoose';
const { Schema } = mongoose;

const productSchema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String },
  category: { type: String },
  variants: [{ type: Schema.Types.ObjectId, ref: 'ProductVariant' }]
}, { timestamps: true });

export const Product = mongoose.model('Product', productSchema);








