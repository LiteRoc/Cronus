import mongoose from "mongoose";
import dotenv from "dotenv";
import Contract from "../models/Contract.js";
import WorkOrder from "../models/WorkOrder.js"; // ← IMPORTANT: core-service has the WO model, so adjust path

dotenv.config();

// ----- Connect to MongoDB -----
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "cronus",
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Mongo connection error:", err.message);
    process.exit(1);
  }
}

async function backfill() {
  const contractId = "6915bc78579e862513ce5f47";

  console.log("Loading contract...");
  const contract = await Contract.findById(contractId);

  if (!contract) {
    console.log("❌ Contract not found");
    return;
  }

  console.log("📄 Contract covers assets:", contract.coveredAssets);

  // 2. Gather all WOs
  let allWO = [];

  for (const assetId of contract.coveredAssets) {
    const workOrders = await WorkOrder.find(
      { assetId },
      { _id: 1 }
    ).lean();

    const ids = workOrders.map((w) => w._id.toString());
    console.log(`📌 Asset ${assetId} has ${ids.length} work orders`);

    allWO.push(...ids);
  }

  // 3. Deduplicate
  const uniqueWO = [...new Set(allWO)];
  console.log("🧮 Total unique WOs to add:", uniqueWO.length);

  // 4. Update contract
  await Contract.findByIdAndUpdate(
    contractId,
    {
      $addToSet: {
        linkedWorkOrders: { $each: uniqueWO },
      },
    }
  );

  console.log("✅ Backfill complete");
}

async function start() {
  await connectDB();
  await backfill();
  mongoose.disconnect();
}

start();
