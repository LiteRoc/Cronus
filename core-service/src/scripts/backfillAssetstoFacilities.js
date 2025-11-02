const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Asset = require('../models/Asset');
const Facility = require('../models/Facility');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cronus';

const assignFacilitiesToAssets = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const facilities = await Facility.find({});
  if (!facilities.length) {
    console.log('No facilities found.');
    return mongoose.disconnect();
  }

  const assets = await Asset.find({});
  if (!assets.length) {
    console.log('No assets found.');
    return mongoose.disconnect();
  }

  let updated = 0;

  for (const asset of assets) {
    const facility = facilities[updated % facilities.length]; // round-robin
    asset.facility = facility._id;
    await asset.save();
    console.log(`✅ Assigned ${asset.ctrlNumber} → ${facility.name}`);
    updated++;
  }

  console.log(`\n✅ Assigned ${updated} assets to facilities.`);
  mongoose.disconnect();
};

assignFacilitiesToAssets().catch(err => {
  console.error(err);
  mongoose.disconnect();
});