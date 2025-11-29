import mongoose from 'mongoose';
const { Schema } = mongoose;

const lineItemSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  quantity: { type: Number, required: true },
  priceAtTimeOfPurchase: { type: Number, required: true },
  subtotal: { type: Number, required: true }
}, { timestamps: true });

export const LineItem = mongoose.model('LineItem', lineItemSchema);








