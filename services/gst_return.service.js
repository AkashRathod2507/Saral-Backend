import mongoose from 'mongoose';
import { GstReturn } from '../models/gst_return.model.js';
import { Invoice } from '../models/invoice.model.js';
import { Transaction } from '../models/transaction.model.js';
import { ApiError } from '../utils/ApiError.js';

const toObjectId = (value) => {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

const coerceNumber = (value = 0) => {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  if (typeof value === 'object' && typeof value.toString === 'function') {
    const parsed = Number(value.toString());
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
const formatPeriod = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const resolvePeriodWindow = (periodInput) => {
  let baseDate;
  if (periodInput) {
    try {
      if (/^\d{4}-\d{2}$/.test(periodInput)) {
        const [year, month] = periodInput.split('-').map(Number);
        baseDate = new Date(year, month - 1, 1);
      } else {
        baseDate = new Date(periodInput);
      }
      if (Number.isNaN(baseDate?.getTime())) {
        baseDate = new Date();
      }
    } catch (_) {
      baseDate = new Date();
    }
  } else {
    baseDate = new Date();
  }

  const start = startOfMonth(baseDate);
  const end = endOfMonth(baseDate);
  const periodLabel = formatPeriod(start);
  return { periodLabel, start, end };
};

const aggregateInvoiceSummary = async ({ organizationId, start, end }) => {
  const match = {
    organizationId: toObjectId(organizationId),
    isDeleted: { $ne: true },
    invoiceDate: { $gte: start, $lte: end }
  };

  if (!match.organizationId) {
    throw new ApiError(400, 'Invalid organization id for GST aggregation');
  }

  const summary = await Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalTaxableValue: {
          $sum: {
            $subtract: [
              { $toDouble: { $ifNull: ['$subTotal', 0] } },
              { $toDouble: { $ifNull: ['$discountTotal', 0] } }
            ]
          }
        },
        totalTax: { $sum: { $toDouble: { $ifNull: ['$taxAmount', 0] } } },
        grossTurnover: { $sum: { $toDouble: { $ifNull: ['$grandTotal', 0] } } }
      }
    }
  ]);

  const grouped = summary[0] || {};

  const invoicesByStatus = await Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        invoices: { $sum: 1 },
        value: { $sum: { $toDouble: { $ifNull: ['$grandTotal', 0] } } }
      }
    }
  ]);

  const bucketMap = {};
  invoicesByStatus.forEach((row) => {
    bucketMap[row._id || 'UNKNOWN'] = {
      count: row.invoices,
      value: coerceNumber(row.value)
    };
  });

  return {
    totalInvoices: coerceNumber(grouped.totalInvoices),
    totalTaxableValue: coerceNumber(grouped.totalTaxableValue),
    totalTax: coerceNumber(grouped.totalTax),
    grossTurnover: coerceNumber(grouped.grossTurnover),
    bucketsByStatus: bucketMap
  };
};

const projectInvoicePreview = {
  invoiceNumber: 1,
  invoiceDate: 1,
  customerName: 1,
  customerGSTIN: 1,
  gstTreatment: 1,
  status: 1,
  supplyType: 1,
  grandTotal: 1,
  taxAmount: 1,
  subTotal: 1,
  discountTotal: 1,
  placeOfSupply: 1,
  cgstTotal: 1,
  sgstTotal: 1,
  igstTotal: 1
};

const aggregateTransactionsSplit = async ({ organizationId, start, end }) => {
  const match = {
    organization_id: toObjectId(organizationId),
    payment_date: { $gte: start, $lte: end },
    status: 'completed'
  };

  const rows = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$direction',
        total: { $sum: { $toDouble: { $ifNull: ['$amount', 0] } } },
        count: { $sum: 1 }
      }
    }
  ]);

  const map = rows.reduce((acc, row) => {
    acc[row._id || 'unknown'] = {
      total: coerceNumber(row.total),
      count: coerceNumber(row.count)
    };
    return acc;
  }, {});

  return {
    paymentsReceived: map.received?.total || 0,
    paymentsMade: map.paid?.total || 0,
    transactionCount: (map.received?.count || 0) + (map.paid?.count || 0)
  };
};

export const generateGstSummary = async ({ organizationId, period, returnType = 'GSTR1' }) => {
  const { periodLabel, start, end } = resolvePeriodWindow(period);

  const invoiceSummary = await aggregateInvoiceSummary({ organizationId, start, end });
  const transactionSummary = await aggregateTransactionsSplit({ organizationId, start, end });

  const summaryBreakup = {
    invoices: invoiceSummary.bucketsByStatus,
    collections: {
      received: transactionSummary.paymentsReceived,
      paid: transactionSummary.paymentsMade
    }
  };

  const payload = {
    organization_id: toObjectId(organizationId),
    period: periodLabel,
    period_start: start,
    period_end: end,
    return_type: returnType,
    total_taxable_value: invoiceSummary.totalTaxableValue,
    total_tax: invoiceSummary.totalTax,
    total_cess: 0,
    gross_turnover: invoiceSummary.grossTurnover,
    payments_received: transactionSummary.paymentsReceived,
    outstanding_tax_liability: Math.max(invoiceSummary.totalTax - (transactionSummary.paymentsMade || 0), 0),
    total_invoices: invoiceSummary.totalInvoices,
    total_transactions: transactionSummary.transactionCount,
    summary_breakup: summaryBreakup
  };

  return payload;
};

export const upsertGstReturn = async ({ organizationId, period, returnType = 'GSTR1', userId }) => {
  const summary = await generateGstSummary({ organizationId, period, returnType });

  const doc = await GstReturn.findOneAndUpdate(
    {
      organization_id: summary.organization_id,
      period: summary.period,
      return_type: returnType
    },
    {
      $set: {
        ...summary,
        status: 'draft',
        updated_by: userId
      },
      $setOnInsert: {
        created_by: userId
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return doc;
};

export const listGstReturns = async ({ organizationId, page = 1, limit = 10 }) => {
  const query = { organization_id: toObjectId(organizationId) };
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    GstReturn.find(query)
      .sort({ period: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    GstReturn.countDocuments(query)
  ]);

  return {
    data,
    total,
    page: Number(page),
    limit: Number(limit)
  };
};

export const getGstReturnById = async ({ id, organizationId }) => {
  const doc = await GstReturn.findOne({ _id: id, organization_id: toObjectId(organizationId) }).lean();
  if (!doc) {
    throw new ApiError(404, 'GST return not found');
  }
  return doc;
};

export const updateGstReturnStatus = async ({ id, organizationId, status, notes, referenceNumber, userId }) => {
  const allowed = ['draft', 'submitted', 'filed', 'paid'];
  if (!allowed.includes(status)) {
    throw new ApiError(400, 'Invalid GST return status');
  }

  const doc = await GstReturn.findOneAndUpdate(
    { _id: id, organization_id: toObjectId(organizationId) },
    {
      $set: { status, notes, updated_by: userId },
      $push: {
        filings: {
          status,
          referenceNumber,
          notes,
          submittedAt: new Date(),
          submittedBy: userId
        }
      }
    },
    { new: true }
  ).lean();

  if (!doc) {
    throw new ApiError(404, 'GST return not found');
  }

  return doc;
};

const foldSectionTotals = (acc, invoice) => {
  const taxable = coerceNumber(invoice.subTotal) - coerceNumber(invoice.discountTotal || 0);
  const tax = coerceNumber(invoice.taxAmount);
  acc.count += 1;
  acc.taxableValue += taxable;
  acc.tax += tax;
  acc.invoiceNumbers.push(invoice.invoiceNumber);
  return acc;
};

const buildDraftSections = (invoices = []) => {
  const sections = {
    b2b: { label: 'B2B Supplies', count: 0, taxableValue: 0, tax: 0, invoiceNumbers: [] },
    b2c: { label: 'B2C Supplies', count: 0, taxableValue: 0, tax: 0, invoiceNumbers: [] },
    export: { label: 'Export / SEZ', count: 0, taxableValue: 0, tax: 0, invoiceNumbers: [] },
    nil: { label: 'Nil / Exempt', count: 0, taxableValue: 0, tax: 0, invoiceNumbers: [] }
  };

  invoices.forEach((invoice) => {
    if (invoice.gstTreatment === 'b2c') {
      foldSectionTotals(sections.b2c, invoice);
    } else if (invoice.gstTreatment === 'export' || invoice.gstTreatment === 'sez') {
      foldSectionTotals(sections.export, invoice);
    } else if (coerceNumber(invoice.subTotal) === 0) {
      foldSectionTotals(sections.nil, invoice);
    } else {
      foldSectionTotals(sections.b2b, invoice);
    }
  });

  return sections;
};

export const buildGstDraft = async ({ organizationId, period }) => {
  const { periodLabel, start, end } = resolvePeriodWindow(period);
  const match = {
    organizationId: toObjectId(organizationId),
    isDeleted: { $ne: true },
    invoiceDate: { $gte: start, $lte: end }
  };

  const invoices = await Invoice.find(match, projectInvoicePreview)
    .sort({ invoiceDate: 1 })
    .lean();

  const sections = buildDraftSections(invoices);

  const totals = invoices.reduce(
    (acc, invoice) => ({
      taxableValue: acc.taxableValue + coerceNumber(invoice.subTotal),
      tax: acc.tax + coerceNumber(invoice.taxAmount),
      invoices: acc.invoices + 1
    }),
    { taxableValue: 0, tax: 0, invoices: 0 }
  );

  return {
    period: periodLabel,
    range: {
      start,
      end
    },
    totals,
    sections,
    invoices: invoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      customerName: invoice.customerName,
      customerGSTIN: invoice.customerGSTIN,
      gstTreatment: invoice.gstTreatment,
      status: invoice.status,
      subTotal: coerceNumber(invoice.subTotal),
      taxAmount: coerceNumber(invoice.taxAmount),
      cgstTotal: coerceNumber(invoice.cgstTotal),
      sgstTotal: coerceNumber(invoice.sgstTotal),
      igstTotal: coerceNumber(invoice.igstTotal),
      placeOfSupply: invoice.placeOfSupply
    }))
  };
};

export const searchGstTransactions = async ({
  organizationId,
  period,
  query,
  gstTreatment,
  status,
  limit = 50
}) => {
  const { start, end } = resolvePeriodWindow(period);
  const match = {
    organizationId: toObjectId(organizationId),
    isDeleted: { $ne: true },
    invoiceDate: { $gte: start, $lte: end }
  };

  if (gstTreatment && gstTreatment !== 'all') {
    match.gstTreatment = gstTreatment;
  }
  if (status && status !== 'all') {
    match.status = status;
  }

  if (query) {
    const regex = new RegExp(query.trim(), 'i');
    match.$or = [
      { invoiceNumber: regex },
      { customerName: regex },
      { customerGSTIN: regex }
    ];
  }

  const results = await Invoice.find(match, projectInvoicePreview)
    .sort({ invoiceDate: -1 })
    .limit(Number(limit) || 50)
    .lean();

  return {
    period: formatPeriod(start),
    total: results.length,
    results: results.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      customerName: invoice.customerName,
      customerGSTIN: invoice.customerGSTIN,
      gstTreatment: invoice.gstTreatment,
      status: invoice.status,
      subTotal: coerceNumber(invoice.subTotal),
      taxAmount: coerceNumber(invoice.taxAmount),
      grandTotal: coerceNumber(invoice.grandTotal),
      igstTotal: coerceNumber(invoice.igstTotal),
      cgstTotal: coerceNumber(invoice.cgstTotal),
      sgstTotal: coerceNumber(invoice.sgstTotal)
    }))
  };
};
