require('dotenv').config();
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');

const createWorkOrder = async (description) => {

    await mongoose.connect(process.env.MONGO_URI);

    const newWorkOrder = new WorkOrder({
        description,
        status: 'Open',
        assetId: new mongoose.Types.ObjectId(), // Use a valid ObjectId
        scheduledDate: new Date(),
        requestDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week later
        workOrderType: 'Corrective Maintenance'
    });

    try {
        await newWorkOrder.save();
        console.log(`Created WorkOrder: ${newWorkOrder.workOrderNumber}`);
    } catch (error) {
        console.error('Error creating WorkOrder:', error);
    }
};

const testConcurrentCreation = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    const promises = [];
    for (let i = 0; i < 5; i++) {
        promises.push(createWorkOrder(`WorkOrder ${i + 1}`));
    }

    await Promise.all(promises);

    await mongoose.disconnect();
};

testConcurrentCreation();
