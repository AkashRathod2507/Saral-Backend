// Lightweight PDF generator using PDFKit (optional dependency)
import fs from 'fs';
let PDFDocument;
try {
  // try dynamic import
  // If PDFKit is not installed, consumer can install `pdfkit`
  PDFDocument = (await import('pdfkit')).default;
} catch (e) {
  PDFDocument = null;
}

function formatCurrency(v) {
  if (v == null) return '0.00';
  return Number(v).toFixed(2);
}

export function generateInvoicePdf(invoice, writableStream, organization = null, customer = null) {
  if (!PDFDocument) throw new Error('pdfkit not installed. Run `npm install pdfkit` to enable PDF generation.');

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  if (writableStream) {
    doc.pipe(writableStream);
  } else {
    const tmp = fs.createWriteStream(`invoice-${invoice._id}.pdf`);
    doc.pipe(tmp);
  }

  // Header
  doc.fontSize(18).text(organization?.business_name || 'Company', { align: 'left' });
  if (organization?.address) {
    const addr = organization.address;
    doc.fontSize(10).text(`${addr.line1 || ''} ${addr.city || ''} ${addr.state || ''}`);
  }
  doc.moveDown();

  doc.fontSize(14).text('Tax Invoice', { align: 'right' });
  doc.moveDown();

  // Invoice meta
  doc.fontSize(10).text(`Invoice No: ${invoice.invoiceNumber}`);
  doc.text(`Date: ${new Date(invoice.invoiceDate || invoice.createdAt).toLocaleDateString()}`);
  doc.text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}`);
  doc.moveDown();

  // Customer
  doc.fontSize(12).text('Bill To:');
  doc.fontSize(10).text(customer?.name || invoice.customerName || 'Customer');
  if (invoice.billingAddress) {
    const b = invoice.billingAddress;
    doc.text(`${b.line1 || ''} ${b.city || ''} ${b.state || ''}`);
  }
  doc.moveDown();

  // Table header
  doc.fontSize(10).text('No', 40, doc.y, { continued: true });
  doc.text('Description', 70, doc.y, { continued: true });
  doc.text('Qty', 320, doc.y, { continued: true });
  doc.text('Rate', 360, doc.y, { continued: true });
  doc.text('Amount', 420, doc.y);
  doc.moveDown(0.5);

  // Items
  (invoice.items || []).forEach((it, idx) => {
    const desc = it.description || it.name || '';
    const qty = it.quantity || 0;
    const rate = it.unitPrice || it.unit_price || it.unitPrice;
    const amt = it.total || (Number(qty) * Number(rate || 0));
    doc.text(String(idx + 1), 40, doc.y, { continued: true });
    doc.text(desc, 70, doc.y, { continued: true });
    doc.text(String(qty), 320, doc.y, { continued: true });
    doc.text(formatCurrency(rate), 360, doc.y, { continued: true });
    doc.text(formatCurrency(amt), 420, doc.y);
    doc.moveDown(0.2);
  });

  doc.moveDown();
  doc.text(`Subtotal: ₹ ${formatCurrency(invoice.subTotal)}`, { align: 'right' });
  doc.text(`Tax: ₹ ${formatCurrency(invoice.taxAmount)}`, { align: 'right' });
  doc.text(`Total: ₹ ${formatCurrency(invoice.grandTotal)}`, { align: 'right' });

  doc.end();
}
