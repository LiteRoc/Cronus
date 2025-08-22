const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Asset = require('./models/Asset');
const Customer = require('./models/Customer');
const Consumable = require('./models/Consumable');

const MONGO_URI = process.env.MONGO_URI;

const consumablesToSeed = [
  {
    ctrlNumber: 'FM-ECG-001',
    name: 'ECG Leads (3-lead set)',
    lotNumber: 'ECG-FM-2025',
    expiresDays: 120,
    quantity: 15
  },
  {
    ctrlNumber: 'FM-INF-001',
    name: 'IV Tubing Set',
    lotNumber: 'IV-FM-2025',
    expiresDays: 90,
    quantity: 20
  },
  {
    ctrlNumber: 'DB-DRD-001',
    name: 'Detector Wipes (Low Lint)',
    lotNumber: 'WIPES-DB-2025',
    expiresDays: 60,
    quantity: 50
  },
  {
    ctrlNumber: 'SN-AED-001',
    name: 'Adult AED Pads',
    lotNumber: 'PAD-SN-2025',
    expiresDays: 30,
    quantity: 6
  },
  {
    ctrlNumber: 'SN-SUCT-001',
    name: 'Suction Canister 1200cc',
    lotNumber: 'SUCT-SN-2025',
    expiresDays: 90,
    quantity: 12
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);

  const now = new Date();

  for (const c of consumablesToSeed) {
    const asset = await Asset.findOne({ ctrlNumber: c.ctrlNumber });
    if (!asset) {
      console.warn(`⚠️ Asset ${c.ctrlNumber} not found. Skipping.`);
      continue;
    }

    const exists = await Consumable.findOne({ assetId: asset._id, name: c.name });
    if (exists) {
      console.log(`⚠️ Consumable ${c.name} already exists for ${c.ctrlNumber}. Skipping.`);
      continue;
    }

    const expiresAt = new Date();
    expiresAt.setDate(now.getDate() + c.expiresDays);

    await Consumable.create({
      customerId: asset.customerId,
      assetId: asset._id,
      name: c.name,
      lotNumber: c.lotNumber,
      quantity: c.quantity,
      expiresAt,
      notes: `Seeded for ${c.ctrlNumber}`,
    });

    console.log(`✅ Added ${c.name} to ${c.ctrlNumber}`);
  }

  process.exit();
}

seed();