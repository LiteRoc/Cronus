const express = require('express');
const WorkOrder = require('../models/WorkOrder');
const Part = require('../models/Part');
const Asset = require('../models/Asset');
const dashboardRouter = express.Router();

// Main dashboard route
dashboardRouter.get('/', async (req, res) => {
  try {
    const { startDate, endDate, status, userId } = req.query;

    // Filters
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const workOrderFilter = {};
    if (Object.keys(dateFilter).length > 0) workOrderFilter.scheduledDate = dateFilter;
    if (status) workOrderFilter.status = status;

    const userFilter = {};
    if (userId) userFilter.userId = userId;

    // Queries
    const workOrdersByStatus = await WorkOrder.aggregate([
      { $match: workOrderFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const countByStatus = workOrdersByStatus.reduce((acc, entry) => {
      acc[entry._id] = entry.count;
      return acc;
    }, {});

    const totalParts = await Part.countDocuments();
    const lowStockParts = await Part.countDocuments({ quantityOnHand: { $lt: 10 } });

    const travelAgg = await WorkOrder.aggregate([
      { $unwind: '$travelLogs' },
      { $match: userFilter },
      { $group: { _id: null, total: { $sum: '$travelLogs.travelTime' } } },
    ]);

    const timeLogAgg = await WorkOrder.aggregate([
      { $unwind: '$timeLogs' },
      { $match: userFilter },
      {
        $group: {
          _id: '$timeLogs.userId',
          totalHours: { $sum: '$timeLogs.timeSpent' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          name: '$user.username',
          totalHours: 1,
        },
      },
    ]);

    const activeAssets = await Asset.countDocuments({ status: 'Active' });
    const inactiveAssets = await Asset.countDocuments({ status: 'Inactive' });
    const dueMaintenance = await Asset.countDocuments({
      'maintenanceSchedule.nextMaintenance': { $lte: new Date() },
    });

    res.status(200).json({
      workOrdersSummary: {
        open: countByStatus.Open || 0,
        closed: countByStatus.Closed || 0,
        overdue: countByStatus.Overdue || 0,
      },
      assetSummary: {
        active: activeAssets,
        inactive: inactiveAssets,
        upcomingMaintenance: dueMaintenance,
      },
      partsSummary: {
        inStock: totalParts,
        lowStock: lowStockParts,
      },
      technicianPerformance: timeLogAgg,
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
