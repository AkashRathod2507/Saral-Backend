#!/usr/bin/env node
/**
 * backfill_customers_org.js
 * Usage:
 *  - Dry run (shows how many docs would be updated):
 *      node scripts/backfill_customers_org.js --orgId=<ORG_OBJECT_ID> --dry
 *  - Apply to all customers without organization_id:
 *      node scripts/backfill_customers_org.js --orgId=<ORG_OBJECT_ID>
 *  - Limit the number updated (safe testing):
 *      node scripts/backfill_customers_org.js --orgId=<ORG_OBJECT_ID> --limit=10
 *
 * The script reads MONGODB_URI from environment (.env file supported via dotenv).
 * It updates documents in the `customers` collection where `organization_id` is missing/null/empty.
 * Always do a dry run first and take a DB backup before applying!
 */

require('dotenv').config();
const mongoose = require('mongoose');

function parseArgs() {
  const out = {};
  const argv = process.argv.slice(2);
  argv.forEach(a => {
    const [k, v] = a.startsWith('--') ? a.slice(2).split('=') : [null, null];
    if (!k) return;
    out[k] = typeof v === 'undefined' ? true : v;
  });
  return out;
}

(async function main() {
  const args = parseArgs();
  const orgId = args.orgId || args.orgid || args.o;
  const dry = args.dry || args.dryRun || args['dry-run'] || false;
  const limit = args.limit ? parseInt(args.limit, 10) : null;

  if (!orgId) {
    console.error('ERROR: --orgId is required (the organization ObjectId to set for customers).');
    console.error('Example: node scripts/backfill_customers_org.js --orgId=64b8f7e0a9c3b123456789ab --dry');
    process.exit(2);
  }

  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not found in environment. Create a .env file in backend with MONGODB_URI or export it.');
    process.exit(2);
  }

  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  } catch (err) {
    console.error('ERROR: Could not connect to MongoDB:', err.message || err);
    process.exit(1);
  }

  const { ObjectId } = mongoose.Types;
  let orgObj;
  try {
    orgObj = new ObjectId(orgId);
  } catch (err) {
    console.error('ERROR: Provided orgId is not a valid ObjectId.');
    await mongoose.disconnect();
    process.exit(2);
  }

  const query = {
    $or: [
      { organization_id: { $exists: false } },
      { organization_id: null },
      { organization_id: '' }
    ]
  };

  const col = mongoose.connection.collection('customers');
  try {
    const total = await col.countDocuments(query);
    console.log(`Found ${total} customers without organization_id.`);
    if (total === 0) {
      await mongoose.disconnect();
      process.exit(0);
    }

    if (dry) {
      console.log('Dry run enabled; no documents will be changed. Use the script without --dry to apply.');
      await mongoose.disconnect();
      process.exit(0);
    }

    if (limit && limit > 0) {
      const docs = await col.find(query).limit(limit).project({ _id: 1 }).toArray();
      const ids = docs.map(d => d._id);
      if (ids.length === 0) {
        console.log('No documents found within limit. Nothing to update.');
        await mongoose.disconnect();
        process.exit(0);
      }
      const res = await col.updateMany({ _id: { $in: ids } }, { $set: { organization_id: orgObj } });
      console.log(`Updated ${res.modifiedCount} documents (limit ${limit}).`);
    } else {
      const res = await col.updateMany(query, { $set: { organization_id: orgObj } });
      console.log(`Updated ${res.modifiedCount} documents (applied to all matching docs).`);
    }
  } catch (err) {
    console.error('ERROR during update:', err.message || err);
    await mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log('Done.');
  process.exit(0);
})();
