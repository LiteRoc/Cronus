// src/cronJobs/cronJobs.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const { sendEmail, sendSMS } = require('../services/notificationService');
const Asset = require('../models/Asset');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');

// Overdue Work Order Notification Job
cron.schedule('0 0 * * *', async () => {
    console.log('Running daily overdue work order check...');
    try {
        const overdueWorkOrders = await WorkOrder.find({
            status: { $ne: 'Completed' },
            scheduledDate: { $lt: new Date() }
        }).populate('assignedTo', 'email phoneNumber username');

        for (const workOrder of overdueWorkOrders) {
            if (workOrder.assignedTo?.email) {
                await sendEmail(
                    workOrder.assignedTo.email,
                    'Overdue Work Order Reminder',
                    `Work Order ID ${workOrder._id} is overdue. Please take action.`
                );
            }

            if (workOrder.assignedTo?.phoneNumber) {
                await sendSMS(
                    workOrder.assignedTo.phoneNumber,
                    `Work Order ID ${workOrder._id} is overdue. Please take action.`
                );
            }

            console.log(`Notification sent for Work Order ID: ${workOrder._id}`);
        }

        console.log(`Processed ${overdueWorkOrders.length} overdue work orders.`);
    } catch (error) {
        console.error('Error in overdue work order notification job:', error);
    }
});

const scheduleMaintenanceJobs = async () => {
    try {
        const today = new Date();
        const todayStart = new Date(today.setHours(0, 0, 0, 0));
        const todayEnd = new Date(today.setHours(23, 59, 59, 999));

        // Query for assets requiring maintenance
        const assets = await Asset.find({
            maintenanceSchedule: { $exists: true },
            $or: [
                { 'maintenanceSchedule.frequency': 'Yearly', 'maintenanceSchedule.startDate': { $lte: todayEnd } },
                { 'maintenanceSchedule.frequency': 'Monthly', 'maintenanceSchedule.startDate': { $lte: todayEnd } },
                {
                    'maintenanceSchedule.frequency': 'Custom',
                    $expr: {
                        $gte: [
                            {
                                $mod: [
                                    {
                                        $subtract: [todayStart, '$maintenanceSchedule.startDate']
                                    },
                                    {
                                        $multiply: ['$maintenanceSchedule.customIntervalDays', 86400000] // Days to ms
                                    }
                                ]
                            },
                            0
                        ]
                    }
                }
            ]
        }).populate('maintenanceSchedule.procedure');

        for (const asset of assets) {
            const { procedure } = asset.maintenanceSchedule;

            // Generate a work order
            const requestDate = new Date();
            const dueDate = new Date();
            dueDate.setDate(requestDate.getDate() + 30);

            const newWorkOrder = new WorkOrder({
                assetId: asset._id,
                description: `Scheduled maintenance for ${asset.ctrlNumber}`,
                status: 'Open',
                scheduledDate: requestDate,
                requestDate,
                dueDate,
                workOrderType: 'Planned Maintenance',
                procedure: procedure._id
            });

            await newWorkOrder.save();
            console.log(`Work order created for asset: ${asset.ctrlNumber}`);
        }
    } catch (error) {
        console.error('Error scheduling maintenance jobs:', error);
    }
};

// Run every day at midnight
cron.schedule('0 0 * * *', scheduleMaintenanceJobs);

module.exports = { scheduleMaintenanceJobs };