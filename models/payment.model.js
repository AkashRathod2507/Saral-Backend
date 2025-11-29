import mongoose from 'mongoose';
const { Schema } = mongoose;

const paymentSchema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  payment_date: { type: Date, default: Date.now },
  amount_received: { type: Number, required: true },
  payment_mode: { 
    type: String, 
    enum: ['bank_transfer', 'credit_card', 'upi', 'cash', 'other'],
    default: 'other'
  },
  notes: { type: String }
}, { timestamps: true });

export const Payment = mongoose.model('Payment', paymentSchema);