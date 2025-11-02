const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const User = require("../models/User");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/cronus";

async function backfillFacilities() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to DB");

  const users = await User.find({ facilityId: { $exists: true, $ne: null } });

  let updatedCount = 0;

  for (const user of users) {
    if (user.facilities && user.facilities.length > 0) {
      continue; // already populated
    }

    // copy facilityId into facilities array
    user.facilities = [user.facilityId];
    await user.save();

    console.log(`✅ Backfilled facilities for ${user.username} (${user._id})`);
    updatedCount++;
  }

  console.log(`🎉 Done. Updated ${updatedCount} users.`);
  mongoose.disconnect();
}

backfillFacilities().catch(err => {
  console.error("❌ Error during backfill:", err);
  mongoose.disconnect();
});