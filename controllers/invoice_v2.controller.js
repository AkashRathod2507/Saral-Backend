import { InvoiceV2 } from "../models/invoice_v2.model.js";
import { Order } from "../models/order.model.js";
import { LineItem } from "../models/line_item.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listInvoicesV2 = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;
  const invoices = await InvoiceV2.find({ organization_id })
    .populate("orderId")
    .populate("customerId", "name")
    .sort({ createdAt: -1 });

  // populate line items for each order
  const result = [];
  for (const inv of invoices) {
    const order = inv.orderId;
    const lineItems = await LineItem.find({ orderId: order._id });
    result.push({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      amountDue: inv.amountDue,
      status: inv.status,
      dueDate: inv.dueDate,
      customer: inv.customerId,
      order: {
        _id: order._id,
        totalAmount: order.totalAmount,
        lineItems
      }
    });
  }

  return res.status(200).json(new ApiResponse(200, result, "Invoices fetched"));
});








