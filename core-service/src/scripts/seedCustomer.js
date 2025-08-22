// seedCustomers.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();

const Customer = require('../models/Customer');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;

async function seed() {
  await mongoose.connect(MONGO_URI);

  const fakeCustomers = [
    {
        name: 'Freddie Mercury',
        department: 'Clinical Engineering',
        contactPerson: {
        name: 'Brian May',
        email: 'brian.may@queenhealth.org',
        phone: '555-123-4567'
        },
        address: {
        line1: '1 Bohemian Rhapsody Blvd',
        city: 'London',
        state: 'UK',
        zip: 'W1A 1AA'
        },
        billingCode: 'FM-001',
        notes: 'VIP – Always under pressure'
    },
    {
        name: 'David Bowie',
        department: 'Radiology',
        contactPerson: {
        name: 'Ziggy Stardust',
        email: 'ziggy@starman.org',
        phone: '555-234-5678'
        },
        address: {
        line1: '2025 Space Oddity Ave',
        city: 'Berlin',
        state: 'DE',
        zip: '10115'
        },
        billingCode: 'DB-002',
        notes: 'Likes modular dashboards'
    },
    {
        name: 'Stevie Nicks',
        department: 'Surgery',
        contactPerson: {
        name: 'Lindsey Buckingham',
        email: 'lindsey@dreams.net',
        phone: '555-345-6789'
        },
        address: {
        line1: '55 Fleetwood Mac Ln',
        city: 'Phoenix',
        state: 'AZ',
        zip: '85001'
        },
        billingCode: 'SN-003',
        notes: 'Part of the gold dust team'
    }
  ];

  for (const customer of fakeCustomers) {
    const existing = await Customer.findOne({ name: customer.name });
    console.log(`⚠️ Customer "${customer.name}" already exists. Skipping.`);
    if (existing) continue;

    const createdCustomer = await Customer.create(customer);
    console.log(`✅ Created customer: ${createdCustomer.name}`);

    const password = await bcrypt.hash('test1234', 10);
    const username = customer.name.toLowerCase().replace(/\s/g, '_');

    await User.create({
      username,
      email: `${username}@thefourstones.com`,
      password,
      role: 'customer',
      customerId: createdCustomer._id,
    });

    console.log(`✅ Created ${customer.name} and customer user: ${customer.username}`);
  }

  process.exit();
}

seed();