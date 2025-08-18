const Asset = require('../models/Asset');
const WorkOrder = require('../models/WorkOrder');
const Procedure = require('../models/Procedure');
const calculateNextMaintenance = require('../utils/calculateNextMaintenance');

const performPlannedMaintenance = async () => {
    const today = new Date();

    // Fetch assets due for maintenance (today or earlier)
    const assetsDue = await Asset.find({
        'maintenanceSchedule.nextMaintenance': { $lte: today },
    }).populate('maintenanceSchedule.procedure');

    console.log(`Found ${assetsDue.length} assets due for maintenance (including past due).`);

    const workOrdersCreated = [];
    for (const asset of assetsDue) {
        // Create Planned Maintenance work order
        const workOrder = new WorkOrder({
            assetId: asset._id,
            description: `Planned Maintenance for ${asset.ctrlNumber}`,
            status: 'Open',
            requestDate: today,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month from today
            scheduledDate: today,
            workOrderType: 'Planned Maintenance',
            procedure: asset.maintenanceSchedule.procedure._id, // Attach procedure
        });

        await workOrder.save();
        workOrdersCreated.push(workOrder);

        // Update asset's maintenance schedule
        asset.maintenanceSchedule.lastMaintenance = today;
        asset.maintenanceSchedule.nextMaintenance = calculateNextMaintenance(
            asset.maintenanceSchedule.frequency,
            today
        ); // Calculate next maintenance

        // Associate the work order with the asset
        asset.workOrders.push(workOrder._id);

        await asset.save();
        console.log(`Updated maintenance schedule for asset ${asset.ctrlNumber}`);
    }

    return workOrdersCreated;
};

module.exports = { performPlannedMaintenance };
