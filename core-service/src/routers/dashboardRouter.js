const express = require('express');
const WorkOrder = require('../models/WorkOrder');
const Part = require('../models/Part');
const Asset = require('../models/Asset');
const Consumable = require('../models/Consumable');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');

const dashboardRouter = express.Router();

const mongoose = require('mongoose');

// Main dashboard route (all roles; always tenant-scoped)
// to make /dashboard internal only, wrap thing with authorizeRoles('admin', 'user')
dashboardRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const tf = buildTenantFilter(req); // now always includes facilityId

    const now = new Date();
    const in30d = new Date(); in30d.setDate(now.getDate() + 30);

    // ---- Common Metrics ----
    const [
      totalAssets,
      upcomingMaintenance,
      totalWorkOrders,
      openWorkOrders,
      overdueWorkOrders,
      lowStockParts,
      expiringConsumables
    ] = await Promise.all([
      Asset.countDocuments(tf),
      Asset.countDocuments({ ...tf, 'maintenanceSchedule.nextMaintenance': { $gte: now, $lte: in30d } }),
      WorkOrder.countDocuments(tf),
      WorkOrder.countDocuments({ ...tf, status: { $in: ['Open', 'In Progress', 'Requested'] } }),
      WorkOrder.countDocuments({ ...tf, status: { $in: ['Open', 'In Progress'] }, dueDate: { $lt: now } }),
      Part.countDocuments({ ...tf, quantityOnHand: { $lt: 10 } }),
      Consumable.countDocuments({ ...tf, expiresAt: { $gte: now, $lte: in30d } }),
    ]);

    // ---- Extended Metrics for internal roles only ----
    let technicianPerformance = [];
    let travelSummary = null;
    let partsSummary = null;

    if (req.user.role !== 'customer') {
      const timeLogsAgg = await WorkOrder.aggregate([
        { $match: { ...tf, status: { $ne: 'Archived' } } },
        { $unwind: '$timeLogs' },
        { $match: { 'timeLogs.timeSpent': { $gt: 0 } } },
        {
          $group: {
            _id: '$timeLogs.userId',
            totalMinutes: { $sum: '$timeLogs.timeSpent' },
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
        {
          $project: {
            userId: '$_id',
            username: { $ifNull: [{ $arrayElemAt: ['$user.username', 0] }, 'Unknown'] },
            role: { $arrayElemAt: ['$user.role', 0] },
            totalMinutes: 1,
            totalHours: { $divide: ['$totalMinutes', 60] },
            workOrdersCount: { $size: '$workOrders' },
          },
        },
        { $sort: { totalMinutes: -1 } },
      ]);

      technicianPerformance = timeLogsAgg;

      const [travelAgg] = await WorkOrder.aggregate([
        { $match: tf },
        { $unwind: '$travelLogs' },
        { $group: { _id: null, totalMinutes: { $sum: '$travelLogs.travelTime' } } }
      ]);

      travelSummary = {
        totalMinutes: travelAgg?.totalMinutes || 0,
        totalHours: (travelAgg?.totalMinutes || 0) / 60,
      };

      partsSummary = {
        lowStock: lowStockParts,
      };
    }

    // ✅ Unified response shape
    res.json({
      assetSummary: {
        total: totalAssets,
        upcomingMaintenance,
      },
      workOrdersSummary: {
        total: totalWorkOrders,
        open: openWorkOrders,
        overdue: overdueWorkOrders,
      },
      expiringConsumables,
      technicianPerformance,
      travelSummary,
      partsSummary,
    });
  } catch (error) {
    console.error('Error generating unified dashboard:', error);
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
