const nodemailer = require('nodemailer');
const twilio = require('twilio');
const WorkOrder = require('../models/WorkOrder');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);


const transporter = nodemailer.createTransport({
    service: 'gmail', // Replace with your email provider (e.g., Outlook, Yahoo)
    auth: {
        user: process.env.EMAIL_USER, // Your email
        pass: process.env.EMAIL_PASS  // Your app password or email password
    }
});

const sendEmail = async (to, subject, text) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        text
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

const sendSMS = async (to, message) => {
    try {
        await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
            to
        });
        console.log(`SMS sent to ${to}`);
    } catch (error) {
        console.error('Error sending SMS:', error);
    }
};

// Enable to run script every time app starts
/*(async () => {
    console.log('Manually running overdue notification job...');
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
        console.error('Error in manual execution:', error);
    }
})();*/


module.exports = { sendEmail, sendSMS };
