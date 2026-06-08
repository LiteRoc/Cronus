const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Asset = require('../models/Asset'); // adjust if needed

const seedData = require('./assets.seed.json');

async function seedAssets() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🚀 Connected to MongoDB');

  for (const asset of seedData.assets) {
    await Asset.findOneAndUpdate(
      { serialNumber: asset.serialNumber }, // adjust unique key
      asset,
      { upsert: true, new: true }
    );
  }

  console.log(`✅ Seeded ${seedData.assets.length} assets`);
  await mongoose.disconnect();
}

seedAssets().catch(console.error);
