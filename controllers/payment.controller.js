import { Payment } from "../models/payment.model.js";
import { Invoice } from "../models/invoice.model.js";
import { Transaction } from "../models/transaction.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createPayment = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;
  const { invoice_id, amount_received, payment_mode, notes } = req.body;

  if (!invoice_id || !amount_received) {
    throw new ApiError(400, "invoice_id and amount_received are required");
  }

  // Invoice v1 uses `organizationId` and `customerId`
  const invoice = await Invoice.findOne({ _id: invoice_id });
  if (!invoice) throw new ApiError(404, "Invoice not found");

  const payment = await Payment.create({
    organization_id,
    invoice_id,
    customer_id: invoice.customerId,
    amount_received,
    payment_mode,
    notes
  });

  // Mirror Payment into Transaction for unified transaction history
  try {
    const transaction_number = `TX-${Date.now()}`;
    await Transaction.create({
      organization_id,
      invoice_id: invoice_id,
      customer_id: invoice.customerId,
      transaction_number,
      amount: Number(amount_received),
      type: 'payment',
      direction: 'received',
      paymentMethod: payment_mode,
      payment_date: payment.payment_date || Date.now(),
      notes: notes,
      status: 'completed'
    });
  } catch (err) {
    // Log but do not fail the payment creation if transaction mirroring fails
    console.error('Failed to mirror Payment to Transaction:', err);
  }

  // Do not persist derived sums on invoice; amounts are derived from Payment in service layer

  return res.status(201).json(new ApiResponse(201, payment, "Payment recorded"));
});

export const getPayments = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;
  const payments = await Payment.find({ organization_id })
    .populate("invoice_id", "invoice_number invoiceNumber")
    .populate("customer_id", "name email")
    .sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, payments, "Payments fetched"));
});







