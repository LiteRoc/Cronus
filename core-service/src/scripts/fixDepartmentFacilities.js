// scripts/fixDepartmentFacilities.js
const mongoose = require("mongoose");
require("dotenv").config();

const Facility = require("../models/Facility");
const Department = require("../models/Department");

const DEFAULT_FACILITY_ID = "68b9934070a2ba9195da1ec6"; // update this with a correct Facility ObjectId

async function fixDepartments() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const facilities = await Facility.find();
  const facilityIds = facilities.map((f) => f._id.toString());

  const departments = await Department.find();

  let updatedCount = 0;

  for (const dept of departments) {
    const currentFacilityId = dept.facilityId?.toString();
    console.log('Current Facility ID:', currentFacilityId);

    if (!currentFacilityId || !facilityIds.includes(currentFacilityId)) {
      console.log(`❌ Department '${dept.name}' has invalid facilityId: ${currentFacilityId}`);

      // 🧠 Option 1: Try to match by name (if names are similar)
      const matchedFacility = facilities.find(f => 
        f.name.toLowerCase().includes(dept.name.toLowerCase())
      );

      // 🧠 Option 2: Fallback to default
      dept.facilityId = matchedFacility?._id || DEFAULT_FACILITY_ID;
      await dept.save();
      updatedCount++;

      console.log(`✅ Updated '${dept.name}' with facilityId: ${dept.facilityId}`);
    }
  }

  console.log(`✅ Done. Updated ${updatedCount} departments.`);
  mongoose.disconnect();
}

fixDepartments().catch((err) => {
  console.error("Error:", err);
  mongoose.disconnect();
});