require('dotenv').config();
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const Contract = require('../models/Contract');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aegisops';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Clean existing seed data (optional)
    await Vendor.deleteMany({});
    await Customer.deleteMany({});
    await Contract.deleteMany({});

    // Create vendors
    const vendor1 = await Vendor.create({
      name: 'Acme Service Corp',
      contactInfo: {
        email: 'support@acmeservice.com',
        phone: '800-555-1000',
        address: '123 Industrial Way'
      },
      notes: 'Preferred vendor for imaging equipment'
    });

    const vendor2 = await Vendor.create({
      name: 'Delta Repairs LLC',
      contactInfo: {
        email: 'contact@deltarepairs.com',
        phone: '800-555-2000',
        address: '456 Tool Blvd'
      },
    });

    // Create customers
    const customer1 = await Customer.create({
      name: 'St. Luke Hospital',
      department: 'Radiology',
      contactPerson: {
        name: 'Emily Hart',
        email: 'emily.hart@stluke.org',
        phone: '614-555-7777'
      },
      address: {
        line1: '1000 Medical Center Dr',
        city: 'Columbus',
        state: 'OH',
        zip: '43210'
      },
      billingCode: 'RAD-1001'
    });

    const customer2 = await Customer.create({
      name: 'Mercy Clinic West',
      department: 'Facilities',
      contactPerson: {
        name: 'James Vance',
        email: 'jvance@mercywest.org',
        phone: '614-555-8888'
      },
      billingCode: 'FAC-2002'
    });

    // Create contracts
    const vendorContract = await Contract.create({
      type: 'vendor',
      name: '2024 Imaging Maintenance - Acme',
      linkedVendor: vendor1._id,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      totalValue: 30000,
      coveredAssets: [], // Link real ones later
      status: 'active',
      notes: 'Annual full-coverage contract for CT/MRI'
    });

    const customerContract = await Contract.create({
      type: 'customer',
      name: 'St. Luke Service Agreement 2024',
      linkedCustomer: customer1._id,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      totalValue: 37500,
      coveredAssets: [],
      status: 'active',
      notes: '5% markup on vendor-managed assets'
    });

    console.log('✅ Seeded vendors, customers, and contracts.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding data:', err);
    process.exit(1);
  }
})();