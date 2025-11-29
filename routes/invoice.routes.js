import { Router } from 'express';
import {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  updatePayment
} from '../controllers/invoice.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

// --- ALL INVOICE ROUTES ARE SECURED ---
router.use(verifyJWT);

// Routes for /api/v1/invoices
router.route("/")
  .post(createInvoice)
  .get(getInvoices);

router.route('/:id')
  .get(getInvoice)
  .put(updateInvoice)
  .delete(deleteInvoice);

// Payment update
router.put('/:id/pay', updatePayment);

// PDF export
router.get('/:id/pdf', async (req, res, next) => {
  // Lazy import to avoid failing when pdfkit missing and route not used
  try {
    const id = req.params.id;
    const { Invoice } = await import('../models/invoice.model.js');
  const inv = await Invoice.findById(id).lean();
  if (!inv) return res.status(404).json({ message: 'Invoice not found' });
  const { Organization } = await import('../models/organization.model.js');
  const { Customer } = await import('../models/customer.model.js');
  const org = inv.organizationId ? await Organization.findById(inv.organizationId).lean() : null;
  const customer = inv.customerId ? await Customer.findById(inv.customerId).lean() : null;
  const { generateInvoicePdf } = await import('../utils/pdfGenerator.js');
  // Stream PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${inv.invoiceNumber}.pdf`);
  generateInvoicePdf(inv, res, org, customer);
  } catch (err) {
    next(err);
  }
});

// We will add routes for /:id later
// router.route("/:id")
//   .get(getInvoiceById)
//   .patch(updateInvoice)
//   .delete(deleteInvoice);

export default router;