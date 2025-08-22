// seedConsumables.js (run once with `node seedConsumables.js`)
const mongoose = require('mongoose');
const Consumable = require('./models/Consumable'); // adjust path
const dotenv = require('dotenv');
dotenv.config();

const customerId = '64fabc123abc456abc789abc'; // Replace with actual
const userId = '64fdef123def456def789def';     // Replace with actual
const assetId = '6501aaa111aaa222aaa333aaa';   // Replace with real asset ID

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const now = new Date();
  const in30 = new Date(); in30.setDate(now.getDate() + 30);
  const in60 = new Date(); in60.setDate(now.getDate() + 60);
  const in90 = new Date(); in90.setDate(now.getDate() + 90);

  const data = [
    {
      customerId,
      assetId,
      name: '3-Lead ECG Cable',
      lotNumber: 'ECG-101A',
      quantity: 10,
      expiresAt: in60,
      notes: 'Check connector wear',
      createdBy: userId,
    },
    {
      customerId,
      assetId,
      name: 'Adult AED Pads',
      lotNumber: 'AED-ADULT-001',
      quantity: 5,
      expiresAt: in30,
      notes: 'Keep dry, temp-sensitive',
      createdBy: userId,
    },
    {
      customerId,
      assetId,
      name: 'Infant AED Pads',
      lotNumber: 'AED-INFANT-003',
      quantity: 3,
      expiresAt: in90,
      createdBy: userId,
    },
    {
      customerId,
      assetId,
      name: 'Suction Canister – 1200cc',
      lotNumber: 'SUC-1200',
      quantity: 20,
      expiresAt: in60,
      createdBy: userId,
    },
  ];

  await Consumable.insertMany(data);
  console.log('✅ Seeded consumables');
  process.exit();
}

seed();