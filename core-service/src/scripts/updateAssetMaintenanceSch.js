require('dotenv').config();
const mongoose = require('mongoose');
const Asset = require('../models/Asset'); // Adjust path to your Asset model

const backfillAssets = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    try {
        const result = await Asset.updateMany(
            { maintenanceSchedule: { $exists: false } },
            { $set: { maintenanceSchedule: null } }
        );

        console.log(`Updated ${result.modifiedCount} assets to include maintenanceSchedule.`);
    } catch (error) {
        console.error('Error during asset backfill:', error);
    } finally {
        await mongoose.disconnect();
    }
};

backfillAssets();
