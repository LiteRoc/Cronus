const express = require('express');
const WorkOrder = require('../models/WorkOrder');
const Part = require('../models/Part');
const Asset = require('../models/Asset');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');

const dashboardRouter = express.Router();

const mongoose = require('mongoose');

// Main dashboard route (all roles; always tenant-scoped)
// to make /dashboard internal only, wrap thing with authorizeRoles('admin', 'user')
dashboardRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const tf = buildTenantFilter(req); // {} for admin/user, {customerId} for customer

    // ----- Filters -----
    const { startDate, endDate, status, userId } = req.query;

    const woDateMatch = (startDate || endDate)
      ? { scheduledDate: {
          ...(startDate ? { $gte: new Date(startDate) } : {}),
          ...(endDate   ? { $lte: new Date(endDate)   } : {}),
        }}
      : {};

    const statusMatch = status ? { status } : {};

    const userObjectId = (userId && mongoose.isValidObjectId(userId))
      ? new mongoose.Types.ObjectId(userId)
      : null;

    // ----- Work Orders summary -----
    // Note: using "Completed" as the closed status. Adjust if your app uses "Closed".
    const now = new Date();
    const woBaseMatch = { ...tf, status: { $ne: 'Archived' }, ...woDateMatch };

    const [woCountsAgg] = await WorkOrder.aggregate([
      { $match: woBaseMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, k: '$_id', v: '$count' } },
      { $group: { _id: null, map: { $push: { k: '$k', v: '$v' } } } },
      { $project: { dict: { $arrayToObject: '$map' } } },
    ]);

    const woDict = woCountsAgg?.dict || {};
    const totalWorkOrders   = Object.values(woDict).reduce((a, b) => a + b, 0);
    const completedWorkOrders = woDict['Completed'] || woDict['Closed'] || 0;
    const openWorkOrders      = totalWorkOrders - completedWorkOrders;

    // Overdue = not completed and dueDate < now
    const overdueWorkOrders = await WorkOrder.countDocuments({
      ...woBaseMatch,
      status: { $ne: 'Completed' },
      dueDate: { $lt: now },
    });

    // ----- Parts summary (tenant-scoped if parts are per-tenant) -----
    const partsBaseMatch = { ...tf, status: { $ne: 'Archived' } };
    const totalParts     = await Part.countDocuments(partsBaseMatch);
    const lowStockParts  = await Part.countDocuments({ ...partsBaseMatch, quantityOnHand: { $lt: 10 } });

    // ----- Technician travel + time (tenant + optional user filter) -----
    // Travel (minutes)
    const travelPipeline = [
      { $match: { ...woBaseMatch } },
      { $unwind: '$travelLogs' },
      ...(userObjectId ? [{ $match: { 'travelLogs.userId': userObjectId } }] : []),
      { $group: { _id: null, totalMinutes: { $sum: '$travelLogs.travelTime' } } },
    ];
    const [travelAgg] = await WorkOrder.aggregate(travelPipeline);
    const totalTravelMinutes = travelAgg?.totalMinutes || 0;

    // Time logs by tech
    const timePipeline = [
      { $match: { ...woBaseMatch } },
      { $unwind: '$timeLogs' },
      { $match: { 'timeLogs.timeSpent': { $gt: 0 } } },
      ...(userObjectId ? [{ $match: { 'timeLogs.userId': userObjectId } }] : []),
      {
        $group: {
          _id: '$timeLogs.userId',
          totalMinutes: { $sum: '$timeLogs.timeSpent' }, // assuming minutes
          workOrders: { $addToSet: '$_id' },
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
      { $project: {
          userId: '$_id',
          username: { $ifNull: [{ $arrayElemAt: ['$user.username', 0] }, 'Unknown'] },
          role:     { $arrayElemAt: ['$user.role', 0] },
          totalMinutes: 1,
          totalHours: { $divide: ['$totalMinutes', 60] },
          workOrdersCount: { $size: '$workOrders' },
        }
      },
      { $sort: { totalMinutes: -1 } },
    ];
    const timeLogAgg = await WorkOrder.aggregate(timePipeline);

    // ----- Asset summary (tenant + exclude archived) -----
    const assetBaseMatch = { ...tf, status: { $ne: 'Archived' } };
    const activeAssets   = await Asset.countDocuments({ ...assetBaseMatch, status: 'Active' });
    const inactiveAssets = await Asset.countDocuments({ ...tf, status: 'Inactive' }); // if you want to include archived inactive, move status filter like above
    const dueMaintenance = await Asset.countDocuments({
      ...assetBaseMatch,
      'maintenanceSchedule.nextMaintenance': { $lte: now },
    });

    // ----- Response -----
    res.status(200).json({
      workOrdersSummary: {
        total: totalWorkOrders,
        open: openWorkOrders,
        completed: completedWorkOrders,
        overdue: overdueWorkOrders,
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
      travelSummary: {
        totalMinutes: totalTravelMinutes,
        totalHours: totalTravelMinutes / 60,
      },
      technicianPerformance: timeLogAgg,
    });
  } catch (error) {
    console.error('Error generating dashboard:', error);
    res.status(500).json({ error: 'Failed to generate dashboard data' });
  }
});

// Work orders summary route -> (tenant scoped)
dashboardRouter.get('/workorders/summary', authenticateToken, async (req, res) => {
  const tenantFilter = buildTenantFilter(req);
    try {
        const base = { ...tenantFilter, status: { $ne: 'Archived' } }; // ignore archived/soft-deleted
        const totalWorkOrders = await WorkOrder.countDocuments({base});
        const completedWorkOrders = await WorkOrder.countDocuments({ ...base,  status: 'Completed' });
        const openWorkOrders = await WorkOrder.countDocuments({ ...base,  status: { $ne: 'Completed' } });
        const overdueWorkOrders = await WorkOrder.countDocuments({
            ...base,
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

// Asset summary route -> (tenant scoped)
dashboardRouter.get('/assets/summary', authenticateToken, async (req, res) => {
  const tenantFilter = buildTenantFilter(req);
    try {
        const base = { ...tenantFilter, status: { $ne: 'Archived' } };
        const totalAssets = await Asset.countDocuments(base);
        const dueMaintenance = await Asset.countDocuments({ ...base,
            'maintenanceSchedule.nextMaintenance': { $lte: new Date() },
        });
        const activeAssets = await Asset.countDocuments({ ...base, status: 'Active' });
        const inactiveAssets = await Asset.countDocuments({ ...tenantFilter, status: 'Inactive' });

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

// Technician performance route -> (tenant scoped) - internal only
dashboardRouter.get('/technicians/performance', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  const tenantFilter = buildTenantFilter(req);

  // Optional date range filter (?start=YYYY-MM-DD&end=YYYY-MM-DD)
    const { start, end } = req.query;
    const dateFilter =
      start || end
        ? {
            'timeLogs.createdAt': {
              ...(start ? { $gte: new Date(start) } : {}),
              ...(end   ? { $lte: new Date(end)   } : {}),
            },
          }
        : {};

     try {
      const pipeline = [
        { $match: { ...tenantFilter, status: { $ne: 'Archived' }, ...dateFilter } },
        { $unwind: '$timeLogs' },
        // skip zero/negative entries if that can happen
        { $match: { 'timeLogs.timeSpent': { $gt: 0 } } },
        {
          $group: {
            _id: '$timeLogs.userId',
            totalMinutes: { $sum: '$timeLogs.timeSpent' }, // assuming minutes
            workOrders: { $addToSet: '$_id' },
          },
        },
        {
          $lookup: {
            from: 'users',                // Mongoose collection name for User
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $project: {
            userId: '$_id',
            username: { $ifNull: [{ $arrayElemAt: ['$user.username', 0] }, 'Unknown'] },
            role:     { $arrayElemAt: ['$user.role', 0] },
            totalMinutes: 1,
            totalHours: { $divide: ['$totalMinutes', 60] },
            workOrdersCount: { $size: '$workOrders' },
          },
        },
        { $sort: { totalMinutes: -1 } },
      ];

      const technicianPerformance = await WorkOrder.aggregate(pipeline);
      res.json(technicianPerformance);
    } catch (error) {
        console.error('Error fetching technician performance:', error);
        res.status(500).json({ error: 'Failed to fetch technician performance' });
    }
});

module.exports = dashboardRouter;
