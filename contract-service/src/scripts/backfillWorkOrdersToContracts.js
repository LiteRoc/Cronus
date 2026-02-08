import mongoose from "mongoose";
import dotenv from "dotenv";
import Contract from "../models/Contract.js";

dotenv.config();

const { Schema } = mongoose;

const WorkOrderSchema = new Schema(
  {
    assetId: { type: Schema.Types.ObjectId },
    requestDate: { type: Date },
    createdAt: { type: Date },
    contractId: { type: Schema.Types.ObjectId },
  },
  { collection: "workorders" }
);

const WorkOrder = mongoose.model("WorkOrder", WorkOrderSchema);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB_NAME || "cronus",
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Mongo connection error:", err.message);
    process.exit(1);
  }
}

function getDateRange(contract) {
  const now = new Date();
  const start = contract.startDate ? new Date(contract.startDate) : null;
  const end = contract.endDate ? new Date(contract.endDate) : null;

  const rangeStart = start || new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
  const rangeEnd = end && end < now ? end : now;

  return { rangeStart, rangeEnd };
}

async function backfillOne(contract) {
  const coveredAssets = (contract.coveredAssets || []).filter(Boolean);
  if (!coveredAssets.length) return { matched: 0, linked: 0, updated: 0, skipped: 0 };

  const { rangeStart, rangeEnd } = getDateRange(contract);

  const workOrders = await WorkOrder.find(
    {
      assetId: { $in: coveredAssets },
      $or: [
        { requestDate: { $gte: rangeStart, $lte: rangeEnd } },
        { requestDate: { $exists: false }, createdAt: { $gte: rangeStart, $lte: rangeEnd } },
      ],
    },
    { _id: 1, contractId: 1 }
  ).lean();

  if (!workOrders.length) return { matched: 0, linked: 0, updated: 0, skipped: 0 };

  const contractIdStr = String(contract._id);
  const eligible = [];
  let skipped = 0;

  for (const wo of workOrders) {
    if (!wo.contractId || String(wo.contractId) === contractIdStr) {
      eligible.push(wo._id);
    } else {
      skipped += 1;
    }
  }

  if (!eligible.length) return { matched: workOrders.length, linked: 0, updated: 0, skipped };

  const updateResult = await WorkOrder.updateMany(
    {
      _id: { $in: eligible },
      $or: [{ contractId: { $exists: false } }, { contractId: null }],
    },
    { $set: { contractId: contract._id } }
  );

  await Contract.findByIdAndUpdate(contract._id, {
    $addToSet: { linkedWorkOrders: { $each: eligible } },
  });

  return {
    matched: workOrders.length,
    linked: eligible.length,
    updated: updateResult.modifiedCount || 0,
    skipped,
  };
}

async function backfill() {
  const contractId = process.env.CONTRACT_ID || process.argv[2];

  const query = contractId ? { _id: contractId } : {};
  const contracts = await Contract.find(query).select("_id name coveredAssets startDate endDate").lean();

  if (!contracts.length) {
    console.log("No contracts found to backfill.");
    return;
  }

  console.log(`Backfilling ${contracts.length} contract(s)...`);

  for (const contract of contracts) {
    const result = await backfillOne(contract);
    console.log(
      `Contract ${contract._id} (${contract.name || "unnamed"}): ` +
        `matched=${result.matched} linked=${result.linked} updated=${result.updated} skipped=${result.skipped}`
    );
  }
}

async function start() {
  await connectDB();
  await backfill();
  await mongoose.disconnect();
}

start();
