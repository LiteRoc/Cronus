const mongoose = require('mongoose');
require('dotenv').config();
const { sendEmail, sendSMS } = require('../services/notificationService');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connection successful.');

    console.log('Running overdue notifications job...');
    try {
        const overdueWorkOrders = await WorkOrder.find({
            status: { $ne: 'Completed' },
            scheduledDate: { $lt: new Date() }
        }).populate('assignedTo', 'email phoneNumber username');

        console.log('Overdue work orders:', overdueWorkOrders);

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
        console.error('Error in script execution:', error);
    } finally {
        await mongoose.disconnect();
    }
})();
