require('dotenv').config();
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');

const cleanupWorkOrders = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const result = await WorkOrder.updateMany(
            {},
            { $unset: { taskResults: "", procedure: "" } }
        );
        console.log(`Cleared taskResults and procedure from ${result.modifiedCount} work orders.`);
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await mongoose.disconnect();
    }
};

cleanupWorkOrders();
