require('dotenv').config();
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
const Procedure = require('../models/Procedure');

const migrateTaskResults = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log('Connected to MongoDB');

        const workOrders = await WorkOrder.find({ taskResults: { $exists: true, $ne: [] } }).populate('procedure');
        console.log(`Found ${workOrders.length} work orders with task results.`);

        for (const workOrder of workOrders) {
            if (workOrder.procedure) {
                const procedure = await Procedure.findById(workOrder.procedure);
                if (procedure) {
                    procedure.taskResults = workOrder.taskResults; // Migrate task results
                    await procedure.save();
                    console.log(`Migrated task results to procedure ${procedure._id} for work order ${workOrder._id}`);
                }
            }

            // Remove taskResults from the work order
            workOrder.taskResults = [];
            await workOrder.save();
            console.log(`Cleared task results from work order ${workOrder._id}`);
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        await mongoose.disconnect();
    }
};

migrateTaskResults();
