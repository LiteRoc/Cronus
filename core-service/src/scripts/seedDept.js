// src/scripts/seedDept.js
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Department = require('../models/Department');
const Facility = require('../models/Facility');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Missing MONGODB_URI (or MONGO_URI) in env');

  await mongoose.connect(uri);

  // Find facility by code (MRH) and use its _id
  const facility = await Facility.findOne({ code: 'MRH' });
  if (!facility) throw new Error('Facility with code "MRH" not found');

  const facilityId = facility._id;

  await Department.findOneAndUpdate(
    { name: 'Urbana Specialty Clinic', facilityId },
    {
      name: 'Urbana Special Clinic',
      facilityId,
      code: '8131',
      notes: '',
    },
    { upsert: true, new: true }
  );

  await Department.findOneAndUpdate(
    { name: 'OB/GYN Clinic', facilityId },
    {
      name: 'OB/GYN Clinic',
      facilityId,
      code: '9630',
      notes: '',
    },
    { upsert: true, new: true }
  );

  await Department.findOneAndUpdate(
    { name: 'Radiology General', facilityId },
    {
      name: 'Radiology General',
      facilityId,
      code: '7120',
      notes: '',
    },
    { upsert: true, new: true }
  );

  console.log('✅ Seeded Department: Central Supply (CS) for facility MRH');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ seedDept failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});