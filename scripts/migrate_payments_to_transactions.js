#!/usr/bin/env node
/**
 * ESM version of migrate_payments_to_transactions.js
 * Use with `node scripts/migrate_payments_to_transactions.js [--dry] [--limit=N]`
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import minimist from 'minimist';

dotenv.config();
const argv = minimist(process.argv.slice(2));
const dry = argv.dry || false;
const limit = argv.limit ? parseInt(argv.limit, 10) : null;

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in environment. Put it in backend/.env or export it.');
  process.exit(2);
}

try {
  await mongoose.connect(MONGODB_URI, { });
  console.log('Connected to MongoDB');

  const Payment = mongoose.connection.collection('payments');
  const Transaction = mongoose.connection.collection('transactions');

  const query = {};
  const totalPayments = await Payment.countDocuments(query);
  console.log(`Payments found: ${totalPayments}`);

  const cursor = Payment.find(query).sort({ createdAt: 1 });
  if (limit) cursor.limit(limit);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  while (await cursor.hasNext()) {
    const pay = await cursor.next();
    try {
      const exists = await Transaction.findOne({ payment_id: pay._id });
      if (exists) { skipped++; continue; }

      const txDoc = {
        organization_id: pay.organization_id || null,
        invoice_id: pay.invoice_id || null,
        customer_id: pay.customer_id || null,
        transaction_number: `TX-PAY-${pay._id}`,
        amount: Number(pay.amount_received || 0),
        type: 'payment',
        direction: 'received',
        paymentMethod: pay.payment_mode || pay.paymentMethod || 'other',
        payment_date: pay.payment_date || pay.createdAt || new Date(),
        notes: pay.notes || '',
        payment_id: pay._id,
        status: 'completed',
        createdAt: pay.createdAt || new Date(),
        updatedAt: pay.updatedAt || new Date()
      };

      if (dry) {
        console.log('[dry] would insert transaction for payment', String(pay._id));
        migrated++;
      } else {
        await Transaction.insertOne(txDoc);
        migrated++;
      }
    } catch (err) {
      console.error('Error migrating payment', pay._id, err.message || err);
      errors++;
    }
  }

  console.log(`Done. migrated=${migrated} skipped=${skipped} errors=${errors}`);
  await mongoose.disconnect();
} catch (err) {
  console.error('Fatal error', err);
  process.exit(1);
}
