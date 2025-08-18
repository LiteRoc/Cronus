require('dotenv').config();
    const WorkOrder = require('../models/WorkOrder');
    const mongoose = require('mongoose');

const backfillWorkOrders = async () => {
    
    await mongoose.connect(process.env.MONGO_URI);

    try {
        // Update work orders without a workOrderType
        await WorkOrder.updateMany(
            { workOrderType: { $exists: false } },
            { $set: { workOrderType: 'Corrective Maintenance' } }
        );

        // Generate workOrderNumber for missing ones
        const workOrders = await WorkOrder.find({ workOrderNumber: { $exists: false } });
        let lastWorkOrderNumber = await WorkOrder.findOne().sort({ workOrderNumber: -1 });
        lastWorkOrderNumber = lastWorkOrderNumber ? parseInt(lastWorkOrderNumber.workOrderNumber, 10) : 0;

        for (const workOrder of workOrders) {
            workOrder.workOrderNumber = (++lastWorkOrderNumber).toString();
            await workOrder.save();
        }

        console.log('Backfill completed');
    } catch (error) {
        console.error('Error during backfill:', error);
    } finally {
        await mongoose.disconnect();
    }
};

backfillWorkOrders();
