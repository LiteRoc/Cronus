// src/scripts/seedAssetsAndConsumables.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Facility from "../models/Facility.js";
import Department from "../models/Department.js";
import Asset from "../models/Asset.js";
import Consumable from "../models/Consumable.js";

await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/aegisops");

console.log("Connected to MongoDB");

await Asset.deleteMany({});
await Consumable.deleteMany({});

const facilities = await Facility.find({});
const departments = await Department.find({});

if (facilities.length === 0 || departments.length === 0) {
  console.log("❌ No facilities or departments found. Seed orgs first.");
  process.exit();
}

// Sample assets
const assetTemplates = [
  {
    manufacturer: "GE Healthcare",
    model: "AMX IV",
    description: "Portable X-Ray Unit",
    status: "Active",
  },
  {
    manufacturer: "Philips",
    model: "IntelliVue MX550",
    description: "Patient Monitor",
    status: "Active",
  },
  {
    manufacturer: "Medtronic",
    model: "Puritan Bennett 980",
    description: "Ventilator",
    status: "Active",
  },
];

// Sample consumables
const consumableTemplates = [
  {
    name: "ECG Lead Set",
    type: "Cable",
    manufacturer: "3M",
    stockLevel: 40,
    reorderLevel: 20,
    unitCost: 12.5,
    shelfLifeMonths: 12,
  },
  {
    name: "AED Pads",
    type: "Pad",
    manufacturer: "Zoll",
    stockLevel: 25,
    reorderLevel: 10,
    unitCost: 39.99,
    shelfLifeMonths: 24,
  },
  {
    name: "Suction Canister",
    type: "Canister",
    manufacturer: "Cardinal Health",
    stockLevel: 60,
    reorderLevel: 30,
    unitCost: 5.0,
    shelfLifeMonths: 36,
  },
];

// Link assets and consumables to random facilities/departments
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const seededAssets = [];

// Seed assets
for (let i = 0; i < 15; i++) {
  const template = getRandom(assetTemplates);
  const facility = getRandom(facilities);
  const dept = getRandom(departments.filter(d => d.facilityId.toString() === facility._id.toString()));

  const asset = await Asset.create({
    ...template,
    ctrlNumber: `CTRL-${Math.floor(1000 + Math.random() * 9000)}`,
    facilityId: facility._id,
    departmentId: dept?._id,
    status: "Active",
    maintenanceSchedule: {
      frequency: "Yearly",
      nextMaintenance: new Date(new Date().setMonth(new Date().getMonth() + 6)),
    },
  });

  seededAssets.push(asset);
}

// Seed consumables
for (const template of consumableTemplates) {
  const asset = getRandom(seededAssets);

  await Consumable.create({
    ...template,
    assetId: asset._id,
    facilityId: asset.facilityId,
    departmentId: asset.departmentId,
    status: "Active",
    expiresAt: new Date(new Date().setMonth(new Date().getMonth() + template.shelfLifeMonths)),
  });
}

console.log("✅ Seeded 15 assets and 3 consumables.");
process.exit();