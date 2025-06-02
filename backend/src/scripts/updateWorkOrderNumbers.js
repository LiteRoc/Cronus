require('dotenv').config();
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');

const updateWorkOrderNumbers = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    try {
        const workOrders = await WorkOrder.find();

        for (const workOrder of workOrders) {
            // Convert workOrderNumber to a number
            const numberValue = parseInt(workOrder.workOrderNumber, 10);

            if (!isNaN(numberValue)) {
                workOrder.workOrderNumber = numberValue;
                await workOrder.save();
                console.log(`Updated workOrderNumber for WorkOrder ID ${workOrder._id}`);
            } else {
                console.warn(`Invalid workOrderNumber "${workOrder.workOrderNumber}" for WorkOrder ID ${workOrder._id}`);
            }
        }

        console.log('WorkOrder numbers updated successfully.');
    } catch (error) {
        console.error('Error updating workOrder numbers:', error);
    } finally {
        await mongoose.disconnect();
    }
};

updateWorkOrderNumbers();
