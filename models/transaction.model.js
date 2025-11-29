import mongoose from 'mongoose';
const { Schema } = mongoose;

const transactionSchema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  // support both invoice v1 and invoice v2 references
  invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'InvoiceV2', index: true },
  customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
  transaction_number: { type: String, required: false, index: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['payment', 'refund'], default: 'payment' },
  // direction indicates whether money was 'received' (in) or 'paid' (out)
  direction: { type: String, enum: ['received', 'paid'], default: 'received' },
  paymentMethod: { type: String },
  payment_date: { type: Date, default: Date.now },
  notes: { type: String },
  // link back to original Payment document when available
  payment_id: { type: Schema.Types.ObjectId, ref: 'Payment', index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' }
}, { timestamps: true });

export const Transaction = mongoose.model('Transaction', transactionSchema);








