require('dotenv').config();
const mongoose = require('mongoose');
const { performPlannedMaintenance } = require('../services/maintenanceService');

const runMaintenanceScript = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log('Running planned maintenance...');
        const workOrders = await performPlannedMaintenance();
        console.log(`Created ${workOrders.length} planned maintenance work orders.`);
    } catch (error) {
        console.error('Error during planned maintenance:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

runMaintenanceScript();
