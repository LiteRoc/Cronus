// syncAssetWorkOrders.js
const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const WorkOrder = require('../models/WorkOrder');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aegisops';

async function syncWorkOrdersToAssets() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const workOrders = await WorkOrder.find({}).select('_id assetId');
    const updates = {};

    workOrders.forEach(({ _id, assetId }) => {
      if (!updates[assetId]) updates[assetId] = [];
      updates[assetId].push(_id);
    });

    const assetIds = Object.keys(updates);
    for (const assetId of assetIds) {
      await Asset.findByIdAndUpdate(assetId, {
        $addToSet: { workOrders: { $each: updates[assetId] } }
      });
    }

    console.log('✅ Sync complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error syncing:', err);
    process.exit(1);
  }
}

syncWorkOrdersToAssets();