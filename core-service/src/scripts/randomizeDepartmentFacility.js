// src/scripts/randomizeDepartmentFacilities.js

const mongoose = require("mongoose");
require("dotenv").config();

const Facility = require("../models/Facility");
const Department = require("../models/Department");

const DRY_RUN = false; // Set to true to simulate only

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const facilities = await Facility.find();
  if (!facilities.length) {
    console.error("❌ No facilities found!");
    return;
  }

  const departments = await Department.find();
  if (!departments.length) {
    console.warn("⚠️ No departments found.");
    return;
  }

  console.log(`🎯 Randomly assigning ${departments.length} departments to ${facilities.length} facilities...`);
  let updated = 0;

  for (const dept of departments) {
    const randomFacility = facilities[Math.floor(Math.random() * facilities.length)];
    const oldId = dept.facilityId?.toString();
    const newId = randomFacility._id.toString();

    if (oldId !== newId) {
      if (DRY_RUN) {
        console.log(`🔄 [DRY RUN] Department "${dept.name}" will change from ${oldId} to ${newId} (${randomFacility.name})`);
      } else {
        dept.facilityId = newId;
        await dept.save();
        console.log(`✅ Updated "${dept.name}" → ${randomFacility.name}`);
        updated++;
      }
    }
  }

  console.log(`\n🎉 ${DRY_RUN ? "Dry run complete" : "Update complete"} — ${updated} department(s) updated.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("💥 Script failed:", err);
  mongoose.disconnect();
});