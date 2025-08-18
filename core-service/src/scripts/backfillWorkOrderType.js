require('dotenv').config();
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');

const backfillWorkOrderType = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);

        console.log('Connected to MongoDB');
        console.log('Starting backfill of workOrderType...');

        // Define the default workOrderType
        const defaultWorkOrderType = 'Corrective Maintenance';

        // Find all work orders missing workOrderType
        const workOrders = await WorkOrder.find({ workOrderType: { $exists: false } });

        console.log(`Found ${workOrders.length} work orders to update.`);

        // Update each work order
        for (const workOrder of workOrders) {
            workOrder.workOrderType = defaultWorkOrderType;
            await workOrder.save();
            console.log(`Updated WorkOrder ID: ${workOrder._id} with workOrderType: ${workOrder.workOrderType}`);
        }

        console.log('Backfill completed successfully.');
    } catch (error) {
        console.error('Error during backfill:', error);
    } finally {
        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

backfillWorkOrderType();
