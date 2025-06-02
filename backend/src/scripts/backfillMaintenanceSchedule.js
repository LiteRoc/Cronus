require('dotenv').config();
const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const Procedure = require('../models/Procedure');

// Default maintenance schedule configuration
const defaultMaintenanceSchedule = {
    frequency: 'Yearly', // Default to Yearly
    lastMaintenance: null, // Assume no prior maintenance
    nextMaintenance: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // Next year
};

const backfillMaintenanceSchedule = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Fetch a default procedure for the maintenance schedule
        const defaultProcedure = await Procedure.findOne();
        if (!defaultProcedure) {
            throw new Error('No default procedure found in the database.');
        }

        // Find assets with no maintenance schedule or missing procedure
        const assetsToUpdate = await Asset.find({
            $or: [
                { maintenanceSchedule: null },
                { 'maintenanceSchedule.procedure': { $exists: false } },
            ],
        });

        console.log(`Found ${assetsToUpdate.length} assets requiring a maintenance schedule update.`);

        for (const asset of assetsToUpdate) {
            asset.maintenanceSchedule = {
                ...defaultMaintenanceSchedule,
                procedure: defaultProcedure._id,
            };
            await asset.save();
            console.log(`Updated asset ${asset.ctrlNumber} with a maintenance schedule.`);
        }

        console.log('Backfill completed successfully.');
    } catch (error) {
        console.error('Error during backfill:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

backfillMaintenanceSchedule();
