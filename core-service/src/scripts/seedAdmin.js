// seedAdmin.cs
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
dotenv.config();

const Organization = require('../models/Organization');
const Facility = require('../models/Facility');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;
const PASSWORD = process.env.ADMIN_PASSWORD || 'password';

async function seedAdmin () {
  await mongoose.connect(MONGO_URI);
  console.log('🛠 Connected to MongoDB');

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    console.log(`✅ Admin already exists: ${existingAdmin.email}`);
    process.exit();
  }

  const org = await Organization.create({
    name: 'Seeded Admin Org',
    type: 'System',
    notes: 'Default org for seeded admin',
  });

  const facility = await Facility.create({
    organizationId: org._id,
    name: 'Admin HQ',
    code: 'ADM-HQ',
    phone: '123-456-7890',
    address: {
      line1: '1 Admin Plaza',
      city: 'Adminville',
      state: 'AD',
      zip: '00000',
    },
  });

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const admin = await User.create({
    username: 'admin',
    email: 'admin@example.com',
    password: passwordHash,
    role: 'admin',
    title: 'Super Admin',
    facilityId: facility._id,
  });

  console.log('✅ Admin user created:', admin.email);
  process.exit();
};

seedAdmin();
