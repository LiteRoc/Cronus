// Deprecated
require('dotenv').config();
const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const Contract = require('../models/Contract');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aegisops';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Fetch existing contracts
    const vendorContract = await Contract.findOne({ type: 'vendor' });
    const customerContract = await Contract.findOne({ type: 'customer' });

    if (!vendorContract || !customerContract) {
      throw new Error('Contracts not found. Run seedContracts.cjs first.');
    }

    // Remove any existing fake assets
    await Asset.deleteMany({ ctrlNumber: /FAKE-ASSET/ });

    // Create 4 fake assets
    const assets = await Asset.insertMany([
      {
        ctrlNumber: 'FAKE-ASSET-001',
        manufacturer: 'GE Healthcare',
        model: 'LightSpeed VCT',
        serialNumber: 'CT123456',
        category: 'Imaging',
        status: 'Active',
      },
      {
        ctrlNumber: 'FAKE-ASSET-002',
        manufacturer: 'Siemens',
        model: 'MAGNETOM Skyra',
        serialNumber: 'MRI789012',
        category: 'Imaging',
        status: 'Active',
      },
      {
        ctrlNumber: 'FAKE-ASSET-003',
        manufacturer: 'Hill-Rom',
        model: 'VersaCare',
        serialNumber: 'BED456789',
        category: 'Biomed',
        status: 'Active',
      },
      {
        ctrlNumber: 'FAKE-ASSET-004',
        manufacturer: 'Steris',
        model: 'AMSCO 400',
        serialNumber: 'STER111222',
        category: 'Sterilizer',
        status: 'Active',
      },
    ]);

    // Link assets to contracts
    vendorContract.coveredAssets.push(assets[0]._id, assets[1]._id);
    customerContract.coveredAssets.push(assets[2]._id, assets[3]._id);

    await vendorContract.save();
    await customerContract.save();

    console.log('✅ Seeded assets and linked them to contracts.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding assets:', err);
    process.exit(1);
  }
})();