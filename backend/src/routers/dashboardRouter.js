const express = require('express');
const WorkOrder = require('../models/WorkOrder');
const Part = require('../models/Part');
const Asset = require('../models/Asset');
const dashboardRouter = express.Router();

// Main dashboard route
dashboardRouter.get('/', async (req, res) => {
    try {
        const { startDate, endDate, status, userId } = req.query;

        // Build date range filter for work orders
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        // Build work order query filter
        const workOrderFilter = {};
        if (Object.keys(dateFilter).length > 0) workOrderFilter.scheduledDate = dateFilter;
        if (status) workOrderFilter.status = status;

        // Build user-specific filter
        const userFilter = {};
        if (userId) userFilter.userId = userId;

        // Aggregate data
        const totalWorkOrders = await WorkOrder.countDocuments(workOrderFilter);
        const workOrdersByStatus = await WorkOrder.aggregate([
            { $match: workOrderFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const totalParts = await Part.countDocuments();
        const lowStockParts = await Part.find({ stock: { $lt: 10 } }).countDocuments();

        const totalTravelTime = await WorkOrder.aggregate([
            { $unwind: '$travelLogs' },
            { $match: userFilter },
            { $group: { _id: null, totalTravelTime: { $sum: '$travelLogs.travelTime' } } }
        ]);

        const totalTimeLogged = await WorkOrder.aggregate([
            { $unwind: '$timeLogs' },
            { $match: userFilter },
            { $group: { _id: '$timeLogs.userId', totalTime: { $sum: '$timeLogs.timeSpent' } } }
        ]);

        // Asset summary
        const activeAssets = await Asset.countDocuments({ status: 'Active' });
        const inactiveAssets = await Asset.countDocuments({ status: 'Inactive' });
        const dueMaintenance = await Asset.countDocuments({
            'maintenanceSchedule.nextMaintenance': { $lte: new Date() },
        });

        res.status(200).json({
            totalWorkOrders,
            workOrdersByStatus,
            totalParts,
            lowStockParts,
            totalTravelTime: totalTravelTime[0]?.totalTravelTime || 0,
            totalTimeLogged,
            assetsSummary: {
                activeAssets,
                inactiveAssets,
                dueMaintenance,
            },
        });
    } catch (error) {
        console.error('Error generating dashboard:', error);
        res.status(500).json({ error: 'Failed to generate dashboard data' });
    }
});

// Work orders summary route
dashboardRouter.get('/workorders/summary', async (req, res) => {
    try {
        const totalWorkOrders = await WorkOrder.countDocuments({});
        const completedWorkOrders = await WorkOrder.countDocuments({ status: 'Completed' });
        const openWorkOrders = await WorkOrder.countDocuments({ status: { $ne: 'Completed' } });
        const overdueWorkOrders = await WorkOrder.countDocuments({
            status: { $ne: 'Completed' },
            dueDate: { $lt: new Date() },
        });

        res.json({
            totalWorkOrders,
            completedWorkOrders,
            openWorkOrders,
            overdueWorkOrders,
        });
    } catch (error) {
        console.error('Error fetching work order summary:', error);
        res.status(500).json({ error: 'Failed to fetch work order summary' });
    }
});

// Asset summary route
dashboardRouter.get('/assets/summary', async (req, res) => {
    try {
        const totalAssets = await Asset.countDocuments({});
        const dueMaintenance = await Asset.countDocuments({
            'maintenanceSchedule.nextMaintenance': { $lte: new Date() },
        });
        const activeAssets = await Asset.countDocuments({ status: 'Active' });
        const inactiveAssets = await Asset.countDocuments({ status: 'Inactive' });

        res.json({
            totalAssets,
            dueMaintenance,
            activeAssets,
            inactiveAssets,
        });
    } catch (error) {
        console.error('Error fetching asset summary:', error);
        res.status(500).json({ error: 'Failed to fetch asset summary' });
    }
});

// Technician performance route
dashboardRouter.get('/technicians/performance', async (req, res) => {
    try {
        const technicianPerformance = await WorkOrder.aggregate([
            { $unwind: '$timeLogs' },
            {
                $group: {
                    _id: '$timeLogs.userId',
                    totalHours: { $sum: '$timeLogs.timeSpent' },
                    workOrders: { $addToSet: '$_id' },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'technician',
                },
            },
            {
                $project: {
                    technician: { $arrayElemAt: ['$technician', 0] },
                    totalHours: 1,
                    workOrdersCount: { $size: '$workOrders' },
                },
            },
        ]);

        res.json(technicianPerformance);
    } catch (error) {
        console.error('Error fetching technician performance:', error);
        res.status(500).json({ error: 'Failed to fetch technician performance' });
    }
});

module.exports = dashboardRouter;
