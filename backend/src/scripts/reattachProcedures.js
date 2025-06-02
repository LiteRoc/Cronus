require('dotenv').config();
const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const WorkOrder = require('../models/WorkOrder');
const Procedure = require('../models/Procedure');

const reattachProcedures = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Fetch all work orders that need procedures re-attached
        const workOrders = await WorkOrder.find({}).populate('assetId');

        for (const workOrder of workOrders) {
            // Skip work orders where no maintenance schedule or procedure is defined
            const procedureId = workOrder.assetId?.maintenanceSchedule?.procedure;
            if (!procedureId) {
                console.log(`Skipping work order ${workOrder._id}, no procedure found.`);
                continue;
            }

            const procedure = await Procedure.findById(procedureId);
            if (!procedure) {
                console.log(`Procedure ${procedureId} not found for work order ${workOrder._id}.`);
                continue;
            }

            // Attach the procedure to the work order
            workOrder.procedure = procedure._id;

            // Generate task results based on procedure tasks
            const taskResults = procedure.tasks.map((taskId) => ({
                taskId,
                result: null, // Default result is null
                timestamp: new Date(),
            }));
            workOrder.taskResults = taskResults;

            await workOrder.save();
            console.log(`Re-attached procedure ${procedure._id} to work order ${workOrder._id}.`);
        }

        console.log('Re-attachment completed successfully.');
    } catch (error) {
        console.error('Error during re-attachment:', error);
    } finally {
        await mongoose.disconnect();
    }
};

reattachProcedures();
