require('dotenv').config();
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
const Counter = require('../models/Counter'); // Import the Counter model

const backfillWorkOrderNumbers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log('Connected to MongoDB');

        // Initialize or fetch the Counter for workOrderNumbers
        let counter = await Counter.findOneAndUpdate(
            { name: 'workOrderNumber' },
            { $setOnInsert: { value: 0 } }, // Create the counter if it doesn't exist
            { new: true, upsert: true }
        );

        console.log(`Current counter value: ${counter.value}`);

        // Fetch all work orders where workOrderNumber is missing or not numeric
        const workOrdersToUpdate = await WorkOrder.find({
            $or: [
                { workOrderNumber: { $exists: false } },
                { workOrderNumber: { $type: "string" } },
            ],
        });

        console.log(`Found ${workOrdersToUpdate.length} work orders to update.`);

        // Update each work order
        for (const workOrder of workOrdersToUpdate) {
            // Increment the counter atomically
            counter = await Counter.findOneAndUpdate(
                { name: 'workOrderNumber' },
                { $inc: { value: 1 } },
                { new: true }
            );

            // Assign the new workOrderNumber
            workOrder.workOrderNumber = counter.value;
            await workOrder.save();

            console.log(
                `Updated WorkOrder ${workOrder._id} with workOrderNumber ${workOrder.workOrderNumber}`
            );
        }

        console.log('Backfill completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error during backfill:', error);
        process.exit(1);
    }
};

backfillWorkOrderNumbers();
