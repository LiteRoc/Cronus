require('dotenv').config();
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');

const backfillWorkOrderDates = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    try {
        console.log('Starting backfill of work order dates...');

        const workOrders = await WorkOrder.find(); // Fetch all work orders

        for (const workOrder of workOrders) {
            const updates = {};

            // If requestDate is missing, set it to the current date
            if (!workOrder.requestDate) {
                updates.requestDate = new Date();
            }

            // If dueDate is missing, set it to one week after the requestDate
            if (!workOrder.dueDate) {
                const requestDate = updates.requestDate || workOrder.requestDate;
                updates.dueDate = new Date(requestDate);
                updates.dueDate.setDate(updates.dueDate.getDate() + 7);
            }

            // Apply updates if any
            if (Object.keys(updates).length > 0) {
                await WorkOrder.findByIdAndUpdate(workOrder._id, updates, { new: true });
                console.log(`Updated WorkOrder ${workOrder._id} with requestDate and dueDate.`);
            }
        }

        console.log('Backfill completed successfully.');
    } catch (error) {
        console.error('Error during backfill:', error);
    } finally {
        await mongoose.disconnect();
    }
};

backfillWorkOrderDates();
