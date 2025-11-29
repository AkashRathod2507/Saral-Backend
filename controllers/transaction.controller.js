import { Transaction } from "../models/transaction.model.js";
import { InvoiceV2 } from "../models/invoice_v2.model.js";
import { Invoice } from "../models/invoice.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createTransaction = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;
  const { invoiceId, amount, type, paymentMethod, status } = req.body;
  if (!invoiceId || !amount) {
    throw new ApiError(400, "invoiceId and amount are required");
  }
  const invoice = await InvoiceV2.findOne({ _id: invoiceId, organization_id });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  // Generate a simple transaction number. In production use a more robust sequence.
  const transaction_number = `TX-${Date.now()}`;

  const tx = await Transaction.create({ organization_id, invoiceId, amount, type, paymentMethod, status, transaction_number, direction: 'received' });
  invoice.transactions.push(tx._id);
  invoice.amountDue = Math.max(0, Number(invoice.amountDue) - Number(amount));
  if (invoice.amountDue === 0) invoice.status = 'paid';
  await invoice.save();

  return res.status(201).json(new ApiResponse(201, tx, "Transaction recorded"));
});

export const listTransactions = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;
  const transactions = await Transaction.find({ organization_id })
    .sort({ createdAt: -1 })
    .populate({
      path: 'invoiceId',
      select: 'invoiceNumber customerId',
      populate: { path: 'customerId', select: 'name' }
    })
    .populate({
      path: 'invoice_id',
      select: 'invoiceNumber customerId',
      populate: { path: 'customerId', select: 'name' }
    })
    .populate('customer_id', 'name');

  // Map into a simpler response shape
  const result = transactions.map(tx => ({
    _id: tx._id,
    transaction_number: tx.transaction_number,
    amount: tx.amount,
    status: tx.status,
    paymentMethod: tx.paymentMethod,
    direction: tx.direction,
    date: tx.createdAt,
    invoice: tx.invoiceId ? {
      _id: tx.invoiceId._id,
      invoiceNumber: tx.invoiceId.invoiceNumber || tx.invoiceId.invoice_number || '',
    } : (tx.invoice_id ? {
      _id: tx.invoice_id._id,
      invoiceNumber: tx.invoice_id.invoice_number || ''
    } : null),
    customer: tx.customer_id ? { _id: tx.customer_id._id, name: tx.customer_id.name }
             : (tx.invoiceId && tx.invoiceId.customerId ? { _id: tx.invoiceId.customerId._id, name: tx.invoiceId.customerId.name } : null)
  }));

  return res.status(200).json(new ApiResponse(200, result, 'Transactions fetched'));
});







