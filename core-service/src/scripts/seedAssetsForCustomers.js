const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Customer = require('../models/Customer');
const Asset = require('../models/Asset');

const MONGO_URI = process.env.MONGO_URI;

const assetsByCustomer = {
  'Freddie Mercury': [
    { ctrlNumber: 'FM-ECG-001', manufacturer: 'GE', model: 'MAC 2000', description: 'ECG Monitor' },
    { ctrlNumber: 'FM-INF-001', manufacturer: 'B. Braun', model: 'Infusomat Space', description: 'Infusion Pump' },
  ],
  'David Bowie': [
    { ctrlNumber: 'DB-XRAY-001', manufacturer: 'Siemens', model: 'Luminos Agile Max', description: 'X-Ray Console' },
    { ctrlNumber: 'DB-DRD-001', manufacturer: 'Canon', model: 'CXDI-710C', description: 'Digital Radiography Detector' },
  ],
  'Stevie Nicks': [
    { ctrlNumber: 'SN-AED-001', manufacturer: 'Zoll', model: 'AED Plus', description: 'AED Unit' },
    { ctrlNumber: 'SN-SUCT-001', manufacturer: 'Medela', model: 'Dominant Flex', description: 'OR Suction System' },
  ],
};

async function seed() {
  await mongoose.connect(MONGO_URI);

  for (const [name, assets] of Object.entries(assetsByCustomer)) {
    const customer = await Customer.findOne({ name });
    if (!customer) {
      console.warn(`⚠️ Customer "${name}" not found. Skipping.`);
      continue;
    }

    for (const asset of assets) {
      const existing = await Asset.findOne({ ctrlNumber: asset.ctrlNumber });
      if (existing) {
        console.log(`⚠️ Asset ${asset.ctrlNumber} already exists. Skipping.`);
        continue;
      }

      await Asset.create({
        ...asset,
        customerId: customer._id,
        facility: customer.address.city,
        department: customer.department,
        serialNumber: `${asset.ctrlNumber}-SN`,
        status: 'Active',
      });

      console.log(`✅ Added ${asset.description} for ${name}`);
    }
  }

  process.exit();
}

seed();