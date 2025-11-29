import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as invoiceService from '../services/invoice.service.js';
import mongoose from 'mongoose';

// Create invoice
const createInvoice = asyncHandler(async (req, res) => {
  const organizationId = req.organization_id;
  const payload = { ...req.body, organizationId, createdBy: req.user?._id };
  // Normalize and validate customerId
  payload.customerId = payload.customerId || payload.customer_id;
  if (!payload.customerId) {
    throw new ApiError(400, 'customerId required');
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const invoice = await invoiceService.createInvoice(payload, { session });
    await invoiceService.adjustStockForInvoice(invoice, { session });
    await session.commitTransaction();
    session.endSession();
    return res.status(201).json(new ApiResponse(201, invoice, 'Invoice created'));
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('createInvoice error', err);
    // Pass through known validation error as 400
    if ((err?.message || '').toLowerCase().includes('customerid required')) {
      throw new ApiError(400, 'customerId required');
    }
    throw new ApiError(500, err.message || 'Failed to create invoice');
  }
});

const getInvoices = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, customerId, fromDate, toDate } = req.query;
  const q = { /* optionally scope by organization using req.organization_id */ };
  const filters = { status, customerId, fromDate, toDate };
  const result = await invoiceService.listInvoices(q, {
    page: Number(page),
    limit: Number(limit),
    filters
  });
  return res.status(200).json(new ApiResponse(200, result, 'Invoices fetched'));
});

const getInvoice = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const invoice = await invoiceService.getInvoiceById(id);
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  return res.status(200).json(new ApiResponse(200, invoice, 'Invoice fetched'));
});

const updateInvoice = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const updated = await invoiceService.updateInvoice(id, req.body);
  return res.status(200).json(new ApiResponse(200, updated, 'Invoice updated'));
});

const deleteInvoice = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const result = await invoiceService.deleteInvoice(id);
  return res.status(200).json(new ApiResponse(200, result, 'Invoice deleted'));
});

const updatePayment = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { amount, paymentInfo } = req.body;
  if (!amount) throw new ApiError(400, 'amount required');
  const updated = await invoiceService.markInvoiceAsPaid(id, amount, paymentInfo || {});
  return res.status(200).json(new ApiResponse(200, updated, 'Payment applied'));
});

export {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  updatePayment
};