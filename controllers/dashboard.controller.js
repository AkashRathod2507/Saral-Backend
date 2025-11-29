import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODELS_DIR = path.join(__dirname, '../models');
const CACHE_DIR = path.join(__dirname, '../cache');
const META_CACHE_FILE = path.join(CACHE_DIR, 'dashboard-metadata.json');
const ORG_FIELD_CANDIDATES = ['organization_id', 'organizationId', 'organization', 'orgId', 'tenantId'];

function parseDateRange(query) {
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (to) to.setHours(23,59,59,999);
  return { from, to };
}

async function dynamicLoadModels() {
  const files = fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('.model.js'));
  const models = {};
  for (const f of files) {
    const filePath = path.join(MODELS_DIR, f);
    const mod = await import(pathToFileURL(filePath).href);
    // exported model name is first exported with capital letter
    for (const [k, v] of Object.entries(mod)) {
      if (v && v.prototype instanceof mongoose.Model) {
        models[k] = v;
      }
    }
  }
  return models;
}

function deriveSchemaMeta(model) {
  const numeric = [];
  const dates = [];
  const s = model.schema;
  s.eachPath((p, schemaType) => {
    const t = schemaType.instance;
    if (['Number', 'Decimal128'].includes(t)) numeric.push(p);
    if (['Date'].includes(t) || p === 'createdAt' || p === 'updatedAt') dates.push(p);
  });
  return { numeric, dates, hasTimestamps: !!s.options.timestamps };
}

function ensureCacheDir() { if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true }); }

function resolveOrgFilter(Model, organizationId) {
  if (!organizationId) return {};
  const paths = Model?.schema?.paths || {};
  for (const field of ORG_FIELD_CANDIDATES) {
    if (Object.prototype.hasOwnProperty.call(paths, field)) {
      return { [field]: organizationId };
    }
  }
  return {};
}

async function buildDashboard(models, organizationId, range) {
  const out = {};

  // Generic metrics for every model
  for (const [name, Model] of Object.entries(models)) {
    // Skip internal/utility collections
    if (['Counter'].includes(name)) continue;
    const meta = deriveSchemaMeta(Model);
    const match = { ...resolveOrgFilter(Model, organizationId) };
    if (range.from || range.to) {
      const dateField = meta.dates.includes('createdAt') ? 'createdAt' : (meta.dates[0] || null);
      if (dateField) {
        match[dateField] = {};
        if (range.from) match[dateField].$gte = range.from;
        if (range.to) match[dateField].$lte = range.to;
      }
    }

    const total = await Model.countDocuments(match);
    out[name] = { count: total };

    // Simple sum for well-known numeric fields if they exist
    const sumFields = ['grandTotal', 'amountDue', 'amount', 'amount_received', 'unit_price'];
    const present = sumFields.filter(f => meta.numeric.includes(f));
    if (present.length) {
      const group = present.reduce((acc, f) => ({ ...acc, [f]: { $sum: { $toDouble: `$${f}` } } }), {});
      const agg = await Model.aggregate([
        { $match: match },
        { $group: { _id: null, ...group } }
      ]);
      if (agg[0]) {
        out[name].sums = {};
        for (const f of present) out[name].sums[f] = agg[0][f] || 0;
      }
    }
  }

  // Domain-specific KPIs (only if models exist)
  const Invoice = models.Invoice;
  const Payment = models.Payment;
  const Item = models.Item;
  const Transaction = models.Transaction;
  if (Invoice) {
    const match = { ...resolveOrgFilter(Invoice, organizationId) };
    if (range.from || range.to) {
      match.invoiceDate = {};
      if (range.from) match.invoiceDate.$gte = range.from;
      if (range.to) match.invoiceDate.$lte = range.to;
    }
    const invoices = await Invoice.aggregate([
      { $match: { ...match, isDeleted: { $ne: true } } },
      { $project: { grandTotal: { $toDouble: '$grandTotal' }, status: 1, invoiceDate: 1 } },
      { $group: { _id: null, revenue: { $sum: '$grandTotal' }, total: { $sum: 1 } } }
    ]);
    out.sales = {
      total: invoices?.[0]?.total || 0,
      revenue: invoices?.[0]?.revenue || 0 // will be overwritten below if Transaction exists
    };
  }
  // Prefer revenue from Transaction model (money actually received)
  if (Transaction) {
    const tMatch = { ...resolveOrgFilter(Transaction, organizationId), direction: 'received', type: 'payment', status: 'completed' };
    if (range.from || range.to) {
      tMatch.payment_date = {};
      if (range.from) tMatch.payment_date.$gte = range.from;
      if (range.to) tMatch.payment_date.$lte = range.to;
    }
    const txnAgg = await Transaction.aggregate([
      { $match: tMatch },
      { $group: { _id: null, revenue: { $sum: { $toDouble: '$amount' } }, count: { $sum: 1 } } }
    ]);
    // Ensure sales object exists
    out.sales = out.sales || { total: 0, revenue: 0 };
    out.sales.revenue = txnAgg?.[0]?.revenue || 0;
  }
  if (Payment) {
    const match = { ...resolveOrgFilter(Payment, organizationId) };
    if (range.from || range.to) {
      match.payment_date = {};
      if (range.from) match.payment_date.$gte = range.from;
      if (range.to) match.payment_date.$lte = range.to;
    }
    const payments = await Payment.aggregate([
      { $match: match },
      { $group: { _id: null, collected: { $sum: '$amount_received' }, count: { $sum: 1 } } }
    ]);
    out.payments = {
      total: payments?.[0]?.count || 0,
      collected: payments?.[0]?.collected || 0
    };
  }
  if (Item) {
    const itemScope = resolveOrgFilter(Item, organizationId);
    const lowStock = await Item.countDocuments({ ...itemScope, stock_quantity: { $lte: 5 } });
    const stockAgg = await Item.aggregate([
      { $match: { ...itemScope } },
      { $group: { _id: null, stock: { $sum: '$stock_quantity' }, items: { $sum: 1 } } }
    ]);
    out.inventory = {
      items: stockAgg?.[0]?.items || 0,
      stockCount: stockAgg?.[0]?.stock || 0,
      lowStock
    };
  }

  return out;
}

export const getDashboard = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id; // available via auth middleware in this project
  const { from, to } = parseDateRange(req.query);
  const range = { from, to };

  const models = await dynamicLoadModels();
  const data = await buildDashboard(models, organization_id, range);

  // heuristic metadata and cache
  const metadata = {};
  for (const [name, Model] of Object.entries(models)) {
    const meta = deriveSchemaMeta(Model);
    metadata[name] = meta;
  }
  ensureCacheDir();
  fs.writeFileSync(META_CACHE_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), metadata }, null, 2));

  return res.status(200).json(new ApiResponse(200, data, 'Dashboard data'));
});

export const getDashboardTimeseries = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;
  const { from, to } = parseDateRange(req.query);

  const models = await dynamicLoadModels();
  const Transaction = models.Transaction;
  let timeseries = [];
  if (Transaction) {
    // Revenue by day from transactions (received payments)
    const tMatch = { ...resolveOrgFilter(Transaction, organization_id), direction: 'received', type: 'payment', status: 'completed' };
    if (from || to) {
      tMatch.payment_date = {};
      if (from) tMatch.payment_date.$gte = from;
      if (to) tMatch.payment_date.$lte = to;
    }
    timeseries = await Transaction.aggregate([
      { $match: tMatch },
      { $project: { day: { $dateToString: { format: "%Y-%m-%d", date: '$payment_date' } }, amount: { $toDouble: '$amount' } } },
      { $group: { _id: '$day', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', revenue: 1, count: 1, _id: 0 } }
    ]);
  } else if (models.Invoice) {
    const Invoice = models.Invoice;
    const match = { ...resolveOrgFilter(Invoice, organization_id), isDeleted: { $ne: true } };
    if (from || to) {
      match.invoiceDate = {};
      if (from) match.invoiceDate.$gte = from;
      if (to) match.invoiceDate.$lte = to;
    }
    timeseries = await Invoice.aggregate([
      { $match: match },
      { $project: { invoiceDate: { $dateToString: { format: "%Y-%m-%d", date: '$invoiceDate' } }, grandTotal: { $toDouble: '$grandTotal' } } },
      { $group: { _id: '$invoiceDate', revenue: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', revenue: 1, count: 1, _id: 0 } }
    ]);
  } else {
    return res.status(404).json(new ApiError(404, 'No suitable model found for timeseries'));
  }

  return res.status(200).json(new ApiResponse(200, { timeseries }, 'Dashboard timeseries'));
});


