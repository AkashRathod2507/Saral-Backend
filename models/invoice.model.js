import mongoose from 'mongoose';
const { Schema } = mongoose;

// Line item subdocument
const lineItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  description: { type: String },
  quantity: { type: Schema.Types.Decimal128, required: true },
  unitPrice: { type: Schema.Types.Decimal128, required: true },
  discount: { type: Schema.Types.Decimal128, default: 0 },
  taxRate: { type: Schema.Types.Decimal128, default: 0 },
  hsnSac: { type: String },
  taxableValue: { type: Schema.Types.Decimal128, default: 0 },
  cgstAmount: { type: Schema.Types.Decimal128, default: 0 },
  sgstAmount: { type: Schema.Types.Decimal128, default: 0 },
  igstAmount: { type: Schema.Types.Decimal128, default: 0 },
  total: { type: Schema.Types.Decimal128, required: true }
}, { _id: false });

const invoiceSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  invoiceDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  status: { type: String, enum: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'], default: 'Draft' },
  currency: { type: String, default: 'INR' },
  notes: { type: String },

  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  customerName: { type: String },
  customerGSTIN: { type: String },
  billingAddress: { type: Object },
  shippingAddress: { type: Object },
  placeOfSupply: { type: String },
  supplyType: { type: String, enum: ['intra', 'inter'], default: 'intra' },
  gstTreatment: { type: String, enum: ['b2b', 'b2c', 'export', 'sez'], default: 'b2b' },
  reverseCharge: { type: Boolean, default: false },
  isExport: { type: Boolean, default: false },

  items: [lineItemSchema],

  subTotal: { type: Schema.Types.Decimal128, default: 0 },
  taxAmount: { type: Schema.Types.Decimal128, default: 0 },
  cgstTotal: { type: Schema.Types.Decimal128, default: 0 },
  sgstTotal: { type: Schema.Types.Decimal128, default: 0 },
  igstTotal: { type: Schema.Types.Decimal128, default: 0 },
  discountTotal: { type: Schema.Types.Decimal128, default: 0 },
  shippingCharge: { type: Schema.Types.Decimal128, default: 0 },
  grandTotal: { type: Schema.Types.Decimal128, default: 0 },
  amountPaid: { type: Schema.Types.Decimal128, default: 0 },
  balanceDue: { type: Schema.Types.Decimal128, default: 0 },

  paymentStatus: { type: String, enum: ['Unpaid', 'Partial', 'Paid'], default: 'Unpaid' },
  paymentMethod: { type: String },
  paymentDate: { type: Date },
  transactionId: { type: String },
  paymentNotes: { type: String },

  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Convert Decimal128 to string/number on toJSON
invoiceSchema.set('toJSON', {
  transform: (doc, ret) => {
    const convert = v => {
      if (v == null) return v;
      if (typeof v === 'object' && v._bsontype === 'Decimal128') return parseFloat(v.toString());
      return v;
    };
    // convert top-level decimals
    [
      'subTotal',
      'taxAmount',
      'cgstTotal',
      'sgstTotal',
      'igstTotal',
      'discountTotal',
      'shippingCharge',
      'grandTotal',
      'amountPaid',
      'balanceDue'
    ].forEach(k => { ret[k] = convert(ret[k]); });
    if (Array.isArray(ret.items)) {
      ret.items = ret.items.map(it => ({
        ...it,
        quantity: convert(it.quantity),
        unitPrice: convert(it.unitPrice),
        discount: convert(it.discount),
        taxRate: convert(it.taxRate),
        taxableValue: convert(it.taxableValue),
        cgstAmount: convert(it.cgstAmount),
        sgstAmount: convert(it.sgstAmount),
        igstAmount: convert(it.igstAmount),
        total: convert(it.total)
      }));
    }
    return ret;
  }
});

invoiceSchema.index({ customerId: 1, invoiceDate: -1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);