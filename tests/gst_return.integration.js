import assert from 'assert';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { Organization } from '../models/organization.model.js';
import { Customer } from '../models/customer.model.js';
import { Invoice } from '../models/invoice.model.js';
import { Transaction } from '../models/transaction.model.js';

async function seedData() {
  const user = await User.create({
    username: 'gsttester',
    email: 'gsttester@example.com',
    password: 'pass1234'
  });

  const organization = await Organization.create({
    owner: user._id,
    business_name: 'Saral QA Org',
    address: {
      state: 'Maharashtra',
      country: 'India'
    }
  });

  const customer = await Customer.create({
    organization_id: organization._id,
    name: 'Acme Retail',
    email: 'acme@example.com',
    gstin: '27ABCDE1234F1Z5',
    place_of_supply: 'Maharashtra'
  });

  await Invoice.create([
    {
      organizationId: organization._id,
      invoiceNumber: 'INV-TEST-001',
      customerId: customer._id,
      status: 'Sent',
      invoiceDate: new Date('2025-11-05'),
      subTotal: 100000,
      discountTotal: 0,
      taxAmount: 18000,
      grandTotal: 118000,
      paymentStatus: 'Unpaid',
      items: []
    },
    {
      organizationId: organization._id,
      invoiceNumber: 'INV-TEST-002',
      customerId: customer._id,
      status: 'Paid',
      invoiceDate: new Date('2025-11-15'),
      subTotal: 50000,
      discountTotal: 0,
      taxAmount: 4500,
      grandTotal: 54500,
      paymentStatus: 'Paid',
      items: []
    }
  ]);

  await Transaction.create([
    {
      organization_id: organization._id,
      invoice_id: null,
      customer_id: customer._id,
      amount: 80000,
      direction: 'received',
      type: 'payment',
      payment_date: new Date('2025-11-18')
    },
    {
      organization_id: organization._id,
      invoice_id: null,
      customer_id: customer._id,
      amount: 10000,
      direction: 'paid',
      type: 'payment',
      payment_date: new Date('2025-11-20')
    }
  ]);

  return { user, organization };
}

(async () => {
  process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'integration-secret';
  process.env.ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '1d';

  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  try {
    const { user } = await seedData();
    const token = user.generateAccessToken();
    const agent = request(app);

    const generateRes = await agent
      .post('/api/v1/gst/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ period: '2025-11', returnType: 'GSTR1' });

    assert.strictEqual(generateRes.status, 201, 'GST summary generation should succeed');
    const summary = generateRes.body?.data;
    assert(summary, 'GST summary response missing data payload');
    assert.strictEqual(Math.round(summary.total_taxable_value), 150000);
    assert.strictEqual(Math.round(summary.total_tax), 22500);
    assert.strictEqual(summary.total_invoices, 2);

    const listRes = await agent
      .get('/api/v1/gst')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(listRes.status, 200, 'GST listing should succeed');
    const listPayload = listRes.body?.data;
    assert(listPayload?.total >= 1, 'GST listing should return at least one record');
    const firstReturn = listPayload.data[0];
    assert.strictEqual(firstReturn._id, summary._id, 'Generated GST return should be returned in list');

    const detailRes = await agent
      .get(`/api/v1/gst/${summary._id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(detailRes.status, 200, 'GST detail fetch should succeed');
    assert.strictEqual(detailRes.body?.data?.period, '2025-11');

    console.log('GST integration tests passed');
    await mongoose.disconnect();
    await mongoServer.stop();
    process.exit(0);
  } catch (err) {
    console.error('GST integration tests failed', err);
    await mongoose.disconnect();
    await mongoServer.stop();
    process.exit(1);
  }
})();
