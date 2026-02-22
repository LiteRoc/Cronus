// src/cronJobs/maintenanceScheduler.js

const cron = require('node-cron');
const { performPlannedMaintenance } = require('../services/maintenanceService');

// Schedule to run daily at midnight
cron.schedule('0 0 * * *', async () => {
    console.log('Running scheduled planned maintenance...');
    await performPlannedMaintenance();
    console.log('Scheduled planned maintenance completed.');
});
