require('dotenv').config();
const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const WorkOrder = require('../models/WorkOrder');

const backfillAssetWorkOrders = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    try {
        const workOrders = await WorkOrder.find();

        for (const workOrder of workOrders) {
            if (workOrder.assetId) {
                const asset = await Asset.findById(workOrder.assetId);

                if (asset) {
                    if (!asset.workOrders) {
                        asset.workOrders = [];
                    }
                    // Avoid duplicate references
                    if (!asset.workOrders.includes(workOrder._id)) {
                        asset.workOrders.push(workOrder._id);
                        await asset.save();
                        console.log(`Linked WorkOrder ${workOrder._id} to Asset ${asset._id}`);
                    }
                } else {
                    console.warn(`Asset not found for WorkOrder ${workOrder._id}`);
                }
            }
        }

        console.log('Backfill completed.');
    } catch (error) {
        console.error('Error during backfill:', error);
    } finally {
        await mongoose.disconnect();
    }
};

backfillAssetWorkOrders();
