const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Facility = require('../models/Facility');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cronus';

const orgFacilityMap = {
  'Queen Health': ['Bohemian Rhapsody Hospital'],
  'Starman Medical': ['Ziggy Stardust Medical Center', 'Under Pressure Clinic'],
  'Seeded Admin Org': ['Admin HQ'],
};

const patch = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('🔌 Connected to DB');

  let updated = 0;

  for (const [orgName, facilityNames] of Object.entries(orgFacilityMap)) {
    const org = await Organization.findOne({ name: orgName });
    if (!org) {
      console.log(`❌ Org "${orgName}" not found`);
      continue;
    }

    for (const name of facilityNames) {
      const facility = await Facility.findOne({ name });
      if (!facility) {
        console.log(`❌ Facility "${name}" not found`);
        continue;
      }

      facility.organizationId = org._id;
      await facility.save();
      console.log(`✅ Linked "${name}" to org "${orgName}"`);
      updated++;
    }
  }

  console.log(`\n✅ Patched ${updated} facilities`);
  mongoose.disconnect();
};

patch().catch((err) => {
  console.error(err);
  mongoose.disconnect();
});