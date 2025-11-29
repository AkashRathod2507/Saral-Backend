import mongoose from 'mongoose';
const { Schema } = mongoose;

const addressSchema = new Schema({
  street: String,
  city: String,
  state: String,
  zip: String,
  country: String,
  type: String,
  name: String
}, { _id: false });

const orderSchema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  orderNumber: { type: String, required: true, unique: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  status: { type: String, enum: ['pending', 'processing', 'shipped', 'cancelled'], default: 'pending' },
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  lineItems: [{ type: Schema.Types.ObjectId, ref: 'LineItem' }],
  totalAmount: { type: Number, required: true, default: 0 }
}, { timestamps: true });

export const Order = mongoose.model('Order', orderSchema);








