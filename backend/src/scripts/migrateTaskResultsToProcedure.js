require('dotenv').config();
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
const Procedure = require('../models/Procedure');

const migrateTaskResults = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Fetch work orders with taskResults
        const workOrders = await WorkOrder.find({ taskResults: { $exists: true, $ne: [] } }).populate('procedure');
        console.log(`Found ${workOrders.length} work orders with task results.`);

        for (const workOrder of workOrders) {
            if (!workOrder.procedure) {
                console.warn(`Work order ${workOrder._id} has taskResults but no associated procedure.`);
                continue;
            }

            const procedure = await Procedure.findById(workOrder.procedure);
            if (!procedure) {
                console.warn(`Procedure ${workOrder.procedure} not found for work order ${workOrder._id}.`);
                continue;
            }

            if (!Array.isArray(workOrder.taskResults)) {
                console.warn(`Work order ${workOrder._id} has invalid taskResults.`);
                continue;
            }

            // Migrate task results to the procedure
            for (const taskResult of workOrder.taskResults) {
                if (!taskResult || !taskResult.taskId) {
                    console.warn(`Invalid taskResult in work order ${workOrder._id}:`, taskResult);
                    continue;
                }

                const existingTaskResult = procedure.taskResults.find(tr => tr.taskId.toString() === taskResult.taskId.toString());
                if (!existingTaskResult) {
                    procedure.taskResults.push({
                        taskId: taskResult.taskId,
                        result: taskResult.result,
                        submittedBy: taskResult.submittedBy || null,
                        timestamp: taskResult.timestamp || new Date(),
                    });
                }
            }

            // Save the updated procedure
            await procedure.save();
            console.log(`Migrated task results to procedure ${procedure._id} for work order ${workOrder._id}.`);

            // Clear taskResults from the work order
            workOrder.taskResults = [];
            await workOrder.save();
            console.log(`Cleared task results from work order ${workOrder._id}.`);
        }

        console.log('Task result migration completed successfully.');
    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        await mongoose.disconnect();
    }
};

migrateTaskResults();
