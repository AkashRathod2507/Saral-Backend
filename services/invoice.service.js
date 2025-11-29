import mongoose from 'mongoose';
import { Invoice } from '../models/invoice.model.js';
import { Item } from '../models/item.model.js';
import { StockMovement } from '../models/stock_movement.model.js';
import { Counter } from '../models/counter.model.js';
import { Payment } from '../models/payment.model.js';
import { Organization } from '../models/organization.model.js';
import { Customer } from '../models/customer.model.js';
import EventEmitter from 'events';

const Decimal = mongoose.Types.Decimal128;
const invoiceEvents = new EventEmitter();

const SUPPLY_INTRA = 'intra';
const SUPPLY_INTER = 'inter';

function toDecimal(n) {
  if (n == null) return Decimal.fromString('0');
  if (typeof n === 'number') return Decimal.fromString(n.toString());
  if (typeof n === 'string') return Decimal.fromString(n);
  return n;
}

const asNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && typeof value.toString === 'function') {
    const parsed = Number(value.toString());
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const splitTaxAmounts = (taxableValue = 0, taxRate = 0, supplyType = SUPPLY_INTRA) => {
  const base = Number(taxableValue) || 0;
  const rate = Number(taxRate) || 0;
  const totalTax = (base * rate) / 100;
  if (!totalTax) {
    return { cgst: 0, sgst: 0, igst: 0 };
  }
  if (supplyType === SUPPLY_INTER) {
    return { cgst: 0, sgst: 0, igst: totalTax };
  }
  const half = totalTax / 2;
  return { cgst: half, sgst: half, igst: 0 };
};

const determineSupplyType = (originState, destinationState) => {
  if (!originState || !destinationState) return SUPPLY_INTRA;
  const origin = originState.trim().toLowerCase();
  const destination = destinationState.trim().toLowerCase();
  return origin === destination ? SUPPLY_INTRA : SUPPLY_INTER;
};

const resolvePlaceOfSupply = (payload = {}, customerDoc = null) => {
  return (
    payload.placeOfSupply ||
    payload.place_of_supply ||
    payload.shippingAddress?.state ||
    payload.billingAddress?.state ||
    customerDoc?.place_of_supply ||
    customerDoc?.addresses?.[0]?.state ||
    ''
  );
};

const finalizeTotals = (baseTotals, shipping = 0, discount = 0) => {
  const taxTotal = baseTotals.cgstTotal + baseTotals.sgstTotal + baseTotals.igstTotal;
  const shippingValue = Number(shipping || 0);
  const discountValue = Number(discount || 0);
  return {
    ...baseTotals,
    taxTotal,
    shipping: shippingValue,
    grandTotal: baseTotals.subTotal - baseTotals.discountTotal + taxTotal + shippingValue - discountValue
  };
};

async function prepareInvoiceLineItems(items = [], supplyType = SUPPLY_INTRA) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      mappedItems: [],
      totals: { subTotal: 0, discountTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0 }
    };
  }

  const idsToHydrate = Array.from(
    new Set(
      items
        .map(it => it.productId || it.item_id)
        .filter(Boolean)
        .map(id => id.toString())
    )
  );

  let catalog = new Map();
  if (idsToHydrate.length) {
    const docs = await Item.find(
      { _id: { $in: idsToHydrate } },
      { hsn_sac_code: 1, tax_rate: 1, unit_price: 1, name: 1 }
    ).lean();
    catalog = new Map(docs.map(doc => [doc._id.toString(), doc]));
  }

  const totals = { subTotal: 0, discountTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0 };

  const mappedItems = items.map(raw => {
    const productId = raw.productId || raw.item_id || null;
    const catalogEntry = productId ? catalog.get(productId.toString()) : null;
    const quantity = Number(raw.quantity ?? raw.qty ?? 0);
    const unitPrice = Number(raw.unitPrice ?? raw.unit_price ?? catalogEntry?.unit_price ?? 0);
    const discount = Number(raw.discount ?? 0);
    const taxRate = Number(raw.taxRate ?? raw.tax_rate ?? catalogEntry?.tax_rate ?? 0);
    const gross = quantity * unitPrice;
    const taxableValue = Math.max(gross - discount, 0);
    const { cgst, sgst, igst } = splitTaxAmounts(taxableValue, taxRate, supplyType);

    totals.subTotal += gross;
    totals.discountTotal += discount;
    totals.cgstTotal += cgst;
    totals.sgstTotal += sgst;
    totals.igstTotal += igst;

    return {
      productId,
      description: raw.description || raw.name || catalogEntry?.name || '',
      quantity: toDecimal(quantity),
      unitPrice: toDecimal(unitPrice),
      discount: toDecimal(discount),
      taxRate: toDecimal(taxRate),
      hsnSac: raw.hsnSac || raw.hsn_sac_code || raw.hsn || catalogEntry?.hsn_sac_code,
      taxableValue: toDecimal(taxableValue),
      cgstAmount: toDecimal(cgst),
      sgstAmount: toDecimal(sgst),
      igstAmount: toDecimal(igst),
      total: toDecimal(taxableValue + cgst + sgst + igst)
    };
  });

  return { mappedItems, totals };
}

export async function generateInvoiceNumber(organizationId) {
  // Use an atomic counter document per organization per year to avoid race conditions.
  const year = new Date().getFullYear();
  const key = `invoice_${organizationId || 'global'}_${year}`;

  const updated = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seq = String(updated.seq).padStart(4, '0');
  return `INV-${year}-${seq}`;
}

export function calculateTotals(items = [], shipping = 0, discount = 0, supplyType = SUPPLY_INTRA) {
  const totals = { subTotal: 0, discountTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0 };

  for (const it of items) {
    const quantity = asNumber(it.quantity);
    const unitPrice = asNumber(it.unitPrice);
    const itemDiscount = asNumber(it.discount);
    const taxRate = asNumber(it.taxRate);
    const taxableValue = asNumber(it.taxableValue) || Math.max(quantity * unitPrice - itemDiscount, 0);

    let cgst = asNumber(it.cgstAmount);
    let sgst = asNumber(it.sgstAmount);
    let igst = asNumber(it.igstAmount);

    if (!cgst && !sgst && !igst) {
      const split = splitTaxAmounts(taxableValue, taxRate, supplyType);
      cgst = split.cgst;
      sgst = split.sgst;
      igst = split.igst;
    }

    totals.subTotal += quantity * unitPrice;
    totals.discountTotal += itemDiscount;
    totals.cgstTotal += cgst;
    totals.sgstTotal += sgst;
    totals.igstTotal += igst;
  }

  return finalizeTotals(totals, shipping, discount);
}

export async function createInvoice(payload, opts = {}) {
  const session = opts.session || null;

  // Default fields extraction
  const {
    customerId: customerIdRaw,
    items = [],
    shippingCharge = 0,
    notes,
    createdBy
  } = payload;

  const customerId = customerIdRaw || payload.customer_id;
  if (!customerId) throw new Error('customerId required');

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(payload.organizationId);

  const [customerDoc, organization] = await Promise.all([
    Customer.findById(customerId).lean(),
    Organization.findById(payload.organizationId).lean()
  ]);

  const placeOfSupply = resolvePlaceOfSupply(payload, customerDoc);
  const supplyType = payload.supplyType || determineSupplyType(organization?.address?.state, placeOfSupply);
  const gstTreatment = payload.gstTreatment || (customerDoc?.gstin ? 'b2b' : 'b2c');
  const customerGSTIN = payload.customerGSTIN || customerDoc?.gstin;

  const { mappedItems, totals: lineTotals } = await prepareInvoiceLineItems(items, supplyType);
  const shippingValue = Number(shippingCharge || 0);
  const finalTotals = finalizeTotals(lineTotals, shippingValue, 0);

  const inv = new Invoice({
    invoiceNumber,
    customerId,
    customerName: payload.customerName,
    customerGSTIN,
    billingAddress: payload.billingAddress,
    shippingAddress: payload.shippingAddress,
    placeOfSupply,
    supplyType,
    gstTreatment,
    organizationId: payload.organizationId,
    items: mappedItems,
    subTotal: toDecimal(lineTotals.subTotal),
    taxAmount: toDecimal(finalTotals.taxTotal),
    cgstTotal: toDecimal(lineTotals.cgstTotal),
    sgstTotal: toDecimal(lineTotals.sgstTotal),
    igstTotal: toDecimal(lineTotals.igstTotal),
    discountTotal: toDecimal(lineTotals.discountTotal),
    shippingCharge: toDecimal(finalTotals.shipping),
    grandTotal: toDecimal(finalTotals.grandTotal),
    amountPaid: toDecimal(0),
    balanceDue: toDecimal(finalTotals.grandTotal),
    paymentStatus: 'Unpaid',
    notes,
    createdBy: createdBy
  });

  if (session) {
    await inv.save({ session });
  } else {
    await inv.save();
  }

  // Emit placeholder event
  try {
    invoiceEvents.emit('invoice:created', { invoiceId: inv._id, invoiceNumber: inv.invoiceNumber });
  } catch (e) {
    // swallow
  }

  return inv;
}

export async function adjustStockForInvoice(invoiceDoc, opts = {}) {
  // Decrement item stock quantities based on invoice items.
  // This is best run inside a session/transaction in production.
  const session = opts.session || null;
  for (const it of invoiceDoc.items) {
    try {
      const qty = Number(it.quantity);
      if (!it.productId) continue;
      if (session) {
        await Item.findByIdAndUpdate(it.productId, { $inc: { stock_quantity: -qty } }, { session });
        await StockMovement.create([{ organization_id: invoiceDoc.organizationId, item_id: it.productId, quantity_change: -qty, reason: 'sale', notes: `Invoice ${invoiceDoc.invoiceNumber}` }], { session });
      } else {
        await Item.findByIdAndUpdate(it.productId, { $inc: { stock_quantity: -qty } });
        await StockMovement.create({ organization_id: invoiceDoc.organizationId, item_id: it.productId, quantity_change: -qty, reason: 'sale', notes: `Invoice ${invoiceDoc.invoiceNumber}` });
      }
    } catch (err) {
      // Log and continue
      console.error('adjustStockForInvoice error', err);
    }
  }
}

export async function getInvoiceById(id) {
  const doc = await Invoice.findById(id)
    .populate('customerId')
    .populate('items.productId')
    .lean();

  if (!doc) return null;
  // derive amountPaid from Payment model if payments exist
  const paidAgg = await Payment.aggregate([
    { $match: { invoice_id: doc._id } },
    { $group: { _id: '$invoice_id', total: { $sum: '$amount_received' } } }
  ]);
  const realPaid = paidAgg?.[0]?.total || 0;
  const grand = asNumber(doc.grandTotal);
  return {
    ...doc,
    amountPaid: realPaid,
    balanceDue: Math.max(0, grand - realPaid),
    paymentStatus: realPaid >= grand ? 'Paid' : realPaid > 0 ? 'Partial' : 'Unpaid'
  };
}

export async function listInvoices(query = {}, options = {}) {
  const { page = 1, limit = 20, sort = { invoiceDate: -1 }, filters = {} } = options;
  const skip = (page - 1) * limit;
  const q = { isDeleted: false, ...query };

  // Apply optional filters
  if (filters.status) q.status = filters.status;
  if (filters.customerId) q.customerId = filters.customerId;
  if (filters.fromDate || filters.toDate) {
    q.invoiceDate = {};
    if (filters.fromDate) q.invoiceDate.$gte = new Date(filters.fromDate);
    if (filters.toDate) q.invoiceDate.$lte = new Date(filters.toDate);
  }

  const docs = await Invoice.find(q)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('customerId')
    .populate('items.productId')
    .lean();
  const total = await Invoice.countDocuments(q);

  // derive payments for all returned invoices in one aggregation
  const ids = docs.map(d => d._id);
  if (ids.length > 0) {
    const payments = await Payment.aggregate([
      { $match: { invoice_id: { $in: ids } } },
      { $group: { _id: '$invoice_id', total: { $sum: '$amount_received' } } }
    ]);
    const idToPaid = new Map(payments.map(p => [String(p._id), p.total]));
    for (const d of docs) {
      const realPaid = idToPaid.get(String(d._id)) || 0;
      const grand = asNumber(d.grandTotal);
      d.amountPaid = realPaid;
      d.balanceDue = Math.max(0, grand - realPaid);
      d.paymentStatus = realPaid >= grand ? 'Paid' : realPaid > 0 ? 'Partial' : 'Unpaid';
    }
  }

  return { data: docs, total, page, limit };
}

export async function markInvoiceAsPaid(invoiceId, amount, paymentInfo = {}) {
  const inv = await Invoice.findById(invoiceId);
  if (!inv) throw new Error('Invoice not found');

  const paid = asNumber(inv.amountPaid) + Number(amount || 0);
  inv.amountPaid = toDecimal(paid);
  inv.balanceDue = toDecimal(asNumber(inv.grandTotal) - paid);
  inv.paymentDate = paymentInfo.paymentDate || new Date();
  inv.transactionId = paymentInfo.transactionId;
  inv.paymentMethod = paymentInfo.method;
  inv.paymentNotes = paymentInfo.notes;

  if (asNumber(inv.balanceDue) <= 0) inv.paymentStatus = 'Paid';
  else if (asNumber(inv.amountPaid) > 0) inv.paymentStatus = 'Partial';

  await inv.save();
  return inv;
}

export async function updateInvoice(invoiceId, payload) {
  const inv = await Invoice.findById(invoiceId);
  if (!inv) throw new Error('Invoice not found');

  // Allow updating fields except immutable identifiers
  const updatable = [
    'invoiceDate', 'dueDate', 'status', 'currency', 'notes',
    'customerId', 'customerName', 'billingAddress', 'shippingAddress',
    'placeOfSupply', 'gstTreatment', 'customerGSTIN', 'supplyType',
    'items', 'shippingCharge', 'amountPaid'
  ];

  for (const k of updatable) {
    if (typeof payload[k] !== 'undefined') inv[k] = payload[k];
  }

  // Recalculate totals when items or shipping change
  const supplyType = inv.supplyType || SUPPLY_INTRA;
  let totalsForInvoice = null;

  if (payload.items) {
    const { mappedItems, totals } = await prepareInvoiceLineItems(payload.items, supplyType);
    inv.items = mappedItems;
    const shippingValue = typeof payload.shippingCharge !== 'undefined'
      ? Number(payload.shippingCharge)
      : asNumber(inv.shippingCharge);
    totalsForInvoice = finalizeTotals(totals, shippingValue, 0);
  }

  if (!totalsForInvoice && (payload.items || typeof payload.shippingCharge !== 'undefined')) {
    const shippingValue = typeof payload.shippingCharge !== 'undefined'
      ? Number(payload.shippingCharge)
      : asNumber(inv.shippingCharge);
    totalsForInvoice = calculateTotals(inv.items, shippingValue, 0, supplyType);
  }

  if (totalsForInvoice) {
    inv.subTotal = toDecimal(totalsForInvoice.subTotal);
    inv.discountTotal = toDecimal(totalsForInvoice.discountTotal);
    inv.cgstTotal = toDecimal(totalsForInvoice.cgstTotal);
    inv.sgstTotal = toDecimal(totalsForInvoice.sgstTotal);
    inv.igstTotal = toDecimal(totalsForInvoice.igstTotal);
    inv.taxAmount = toDecimal(totalsForInvoice.taxTotal);
    inv.shippingCharge = toDecimal(totalsForInvoice.shipping);
    inv.grandTotal = toDecimal(totalsForInvoice.grandTotal);
  }

  // Recompute balance/paymentStatus if amountPaid provided
  if (typeof payload.amountPaid !== 'undefined') {
    const paid = asNumber(inv.amountPaid);
    inv.balanceDue = toDecimal(asNumber(inv.grandTotal) - paid);
    if (asNumber(inv.balanceDue) <= 0) inv.paymentStatus = 'Paid';
    else if (paid > 0) inv.paymentStatus = 'Partial';
    else inv.paymentStatus = 'Unpaid';
  }

  await inv.save();
  return inv;
}

export async function deleteInvoice(invoiceId) {
  const inv = await Invoice.findById(invoiceId);
  if (!inv) throw new Error('Invoice not found');
  inv.isDeleted = true;
  await inv.save();
  return { success: true };
}

export default {
  generateInvoiceNumber,
  calculateTotals,
  // aliases for spec naming
  calculateInvoiceTotals: calculateTotals,
  createInvoice,
  adjustStockForInvoice,
  listInvoices,
  getInvoiceById,
  markInvoiceAsPaid,
  updateInvoice,
  deleteInvoice,
  invoiceEvents
};
