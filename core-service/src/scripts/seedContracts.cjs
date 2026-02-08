import mongoose from "mongoose";
import Contract from "../models/Contract.js";

const CONTRACTS = [
  {
    _id: new mongoose.Types.ObjectId("691500000000000000000001"),
    name: "IV Pumps – Service Agreement",
    vendorId: new mongoose.Types.ObjectId("6914f4e2dc1378d8208f4698"),
    customerId: new mongoose.Types.ObjectId("6914f4b42a7d38d36f99b877"),
    status: "Active",
    startDate: new Date("2025-01-01"),
    endDate: new Date("2026-01-01"),
    annualValue: 45000,
    coveredAssets: [
      new mongoose.Types.ObjectId("69060f23a070882cfbd17021"),
      new mongoose.Types.ObjectId("69060f23a070882cfbd17022")
    ],
    notes: "Seeded contract",
  }
];

async function seedContracts() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  for (const c of CONTRACTS) {
    const exists = await Contract.findById(c._id);
    if (!exists) {
      await Contract.create(c);
      console.log("Inserted:", c.name);
    } else {
      console.log("Already exists:", c.name);
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seedContracts();