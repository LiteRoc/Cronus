// core-service/seedVendors.js
const mongoose = require("mongoose");
const Vendor = require("../models/Vendor");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/cronus";

const vendors = [
  {
    name: "Probo Medical",
    contactInfo: {
      email: "service@probomedical.com",
      phone: "800-555-1985",
      address: "123 Ultrasound Blvd, Nashville, TN",
    },
    notes: "Ultrasound and probe repairs",
  },
  {
    name: "Block Imaging",
    contactInfo: {
      email: "sales@blockimaging.com",
      phone: "517-655-8800",
      address: "3475 Belle Chase Way, Lansing, MI",
    },
    notes: "Imaging systems and parts supplier",
  },
  {
    name: "Avante Health Solutions",
    contactInfo: {
      email: "info@avantehs.com",
      phone: "800-979-6795",
      address: "2600 Stanley Gault Pkwy, Louisville, KY",
    },
    notes: "Multi-modality service vendor",
  },
  {
    name: "Olympus America",
    contactInfo: {
      email: "endoservice@olympus.com",
      phone: "888-555-2400",
      address: "3500 Corporate Pkwy, Center Valley, PA",
    },
    notes: "Endoscopy OEM service",
  },
  {
    name: "Stryker Medical",
    contactInfo: {
      email: "support@stryker.com",
      phone: "800-555-7475",
      address: "1941 Stryker Rd, Portage, MI",
    },
    notes: "Surgical and equipment service",
  },
];

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    await Vendor.deleteMany({});
    const result = await Vendor.insertMany(vendors);
    console.log(`✅ Seeded ${result.length} vendors.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding vendors:", err);
    process.exit(1);
  }
})();