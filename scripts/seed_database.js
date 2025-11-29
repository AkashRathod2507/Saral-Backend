import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';

import { Organization } from '../models/organization.model.js';
import { User } from '../models/user.model.js';
import { Customer } from '../models/customer.model.js';
import { Item } from '../models/item.model.js';
import { Invoice } from '../models/invoice.model.js';
import { Payment } from '../models/payment.model.js';
import { Transaction } from '../models/transaction.model.js';

dotenv.config({ path: './.env' });

const MONGO = process.env.MONGODB_URL;
if (!MONGO) {
  console.error('Please set MONGODB_URL in .env');
  process.exit(1);
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  await mongoose.connect(MONGO, { autoIndex: true });
  console.log('Connected to MongoDB for seeding');

  // Clean existing sample data (be careful)
  await Promise.all([
    Invoice.deleteMany({}),
    Payment.deleteMany({}),
    Transaction.deleteMany({}),
    Customer.deleteMany({}),
    Item.deleteMany({}),
    Organization.deleteMany({}),
    User.deleteMany({})
  ]);

  // Create admin user and organization
  const admin = await User.create({ username: 'admin', email: 'admin@demo.test', password: 'Password123!', roles: ['admin'] });
  const org = await Organization.create({
    owner: admin._id,
    business_name: faker.company.name(),
    gstin: faker.string.alphanumeric(15).toUpperCase(),
    address: {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      pincode: faker.location.zipCode(),
      country: 'India'
    }
  });

  // Create customers
  const customers = [];
  for (let i = 0; i < 60; i++) {
    const c = await Customer.create({
      organization_id: org._id,
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number('91##########'),
      addresses: []
    });
    customers.push(c);
  }

  // Create items
  const items = [];
  const categories = ['Office Supplies','Electronics','Groceries','Clothing','Services','Accessories'];
  for (let i = 0; i < 40; i++) {
    const name = `${faker.commerce.productName()} ${faker.helpers.arrayElement(categories)}`;
    const it = await Item.create({
      organization_id: org._id,
      name,
      item_type: faker.helpers.arrayElement(['product','service']),
      unit_price: Number(faker.commerce.price({ min: 50, max: 20000, dec: 2 })),
      stock_quantity: randInt(0, 250),
      hsn_sac_code: faker.string.alphanumeric(8).toUpperCase(),
      tax_rate: faker.helpers.arrayElement([0,5,12,18,28])
    });
    items.push(it);
  }

  // Create invoices for customers across last 120 days
  const invoices = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 120);

  let invoiceCounter = 1000;
  for (const cust of customers) {
    const invCount = randInt(0, 8);
    for (let j = 0; j < invCount; j++) {
      const itemCount = randInt(1,6);
      const chosen = [];
      let subTotal = 0;
      const lineItems = [];
      for (let k = 0; k < itemCount; k++) {
        const it = faker.helpers.arrayElement(items);
        const qty = randInt(1, 10);
        const unit = Number(it.unit_price);
        const taxRate = Number(it.tax_rate || 0);
        const discount = faker.datatype.boolean() ? Number((Math.random() * 50).toFixed(2)) : 0;
        const total = Number(((unit * qty) - discount) + ((unit * qty - discount) * (taxRate/100)));
        subTotal += Number((unit * qty) - discount);
        lineItems.push({ productId: it._id, description: it.name, quantity: qty, unitPrice: unit, discount, taxRate, total });
      }
      const taxAmount = Number((subTotal * (faker.helpers.arrayElement([0.05,0.12,0.18,0.0]))).toFixed(2));
      const shipping = Number((Math.random() * 200).toFixed(2));
      const discountTotal = Number((Math.random() < 0.2 ? Math.random() * 100 : 0).toFixed(2));
      const grandTotal = Number((subTotal + taxAmount + shipping - discountTotal).toFixed(2));

      const invoiceDate = new Date(startDate.getTime() + Math.random() * (Date.now() - startDate.getTime()));
      const dueDate = new Date(invoiceDate.getTime()); dueDate.setDate(invoiceDate.getDate() + 30);

      const invoice = await Invoice.create({
        organizationId: org._id,
        invoiceNumber: `INV-${new Date().getFullYear()}-${++invoiceCounter}`,
        invoiceDate,
        dueDate,
        status: faker.helpers.arrayElement(['Draft','Sent','Paid','Overdue']),
        currency: 'INR',
        customerId: cust._id,
        customerName: cust.name,
        items: lineItems,
        subTotal,
        taxAmount,
        discountTotal,
        shippingCharge: shipping,
        grandTotal,
        amountPaid: 0,
        balanceDue: grandTotal,
        paymentStatus: 'Unpaid'
      });

      // Possibly mark paid or partially paid
      if (Math.random() < 0.7) {
        const paid = Number((grandTotal * (Math.random() < 0.8 ? 1 : (0.3 + Math.random()*0.6))).toFixed(2));
        invoice.amountPaid = paid;
        invoice.balanceDue = Number((grandTotal - paid).toFixed(2));
        invoice.paymentStatus = invoice.balanceDue <= 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid');
        if (invoice.paymentStatus === 'Paid') invoice.status = 'Paid';
        await invoice.save();

        // Create payment and transaction
        const payment = await Payment.create({
          organization_id: org._id,
          invoice_id: invoice._id,
          customer_id: cust._id,
          payment_date: new Date(invoiceDate.getTime() + randInt(0,20)*24*3600*1000),
          amount_received: paid,
          payment_mode: faker.helpers.arrayElement(['bank_transfer','credit_card','upi','cash'])
        });

        await Transaction.create({
          organization_id: org._id,
          invoice_id: invoice._id,
          customer_id: cust._id,
          transaction_number: `TXN-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          amount: paid,
          type: 'payment',
          direction: 'received',
          paymentMethod: payment.payment_mode,
          payment_date: payment.payment_date,
          payment_id: payment._id,
          status: 'completed'
        });
      }

      invoices.push(invoice);
    }
  }

  console.log(`Seeded: org=${1}, users=1, customers=${customers.length}, items=${items.length}, invoices=${invoices.length}`);

  // Quick revenue check
  const agg = await Invoice.aggregate([
    { $match: { organizationId: org._id, isDeleted: { $ne: true } } },
    { $project: { grandTotal: { $toDouble: '$grandTotal' } } },
    { $group: { _id: null, revenue: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
  ]);
  console.log('Invoices total', agg?.[0]?.count || 0, 'Revenue:', agg?.[0]?.revenue || 0);

  await mongoose.disconnect();
  console.log('Seeding complete and disconnected');
}

seed().catch(err => { console.error('Seeding error', err); process.exit(1); });
