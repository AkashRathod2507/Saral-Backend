import mongoose from 'mongoose';
const { Schema } = mongoose;

const filingHistorySchema = new Schema({
  status: {
    type: String,
    enum: ['draft', 'submitted', 'filed', 'paid'],
    default: 'draft'
  },
  referenceNumber: String,
  notes: String,
  submittedAt: Date,
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { _id: false, timestamps: false });

const gstReturnSchema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  period: { type: String, required: true }, // e.g. 2025-11
  period_start: { type: Date, required: true },
  period_end: { type: Date, required: true },
  return_type: { type: String, enum: ['GSTR1', 'GSTR3B', 'ANNUAL'], default: 'GSTR1' },
  total_taxable_value: { type: Number, default: 0 },
  total_tax: { type: Number, default: 0 },
  total_cess: { type: Number, default: 0 },
  gross_turnover: { type: Number, default: 0 },
  payments_received: { type: Number, default: 0 },
  outstanding_tax_liability: { type: Number, default: 0 },
  total_invoices: { type: Number, default: 0 },
  total_transactions: { type: Number, default: 0 },
  summary_breakup: {
    type: Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'filed', 'paid'],
    default: 'draft'
  },
  notes: String,
  filings: [filingHistorySchema],
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  updated_by: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

gstReturnSchema.index({ organization_id: 1, period: 1, return_type: 1 }, { unique: true });

gstReturnSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const GstReturn = mongoose.model('GstReturn', gstReturnSchema);
