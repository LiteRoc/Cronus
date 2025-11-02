// This route is deprecated. Use /dashboard instead.


const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');
const Asset = require('../models/Asset');
const WorkOrder = require('../models/WorkOrder');
const Consumable = require('../models/Consumable'); // assume exists
const Ticket = require('../models/Tickets');         // simple request/approval queue

const portalRouter = express.Router();

portalRouter.use(authenticateToken, authorizeRoles('customer'));

// tenant/portal guard
/*function buildTenantFilter(req) {
  if (req.user?.role !== 'customer' || !req.user?.customerId) {
    // extra hardening: only customers can access, enforce customerId presence
    return null;
  }
  return { customerId: new mongoose.Types.ObjectId(req.user.customerId) };
}*/

// ---------- DASHBOARD SUMMARY ----------
portalRouter.get('/dashboard/summary', async (req, res) => {
  const filter = buildTenantFilter(req);
  if (!filter) return res.status(403).json({ error: 'Forbidden' });

  const now = new Date();
  const in30d = new Date(); in30d.setDate(now.getDate() + 30);

  try {
    const [
      assetCount,
      openWOCount,
      overdueWOCount,
      upcomingMaintCount,
      expiringConsumablesCount,
    ] = await Promise.all([
      Asset.countDocuments(filter),
      WorkOrder.countDocuments({ ...filter, status: { $in: ['Open','In Progress','Requested'] } }),
      WorkOrder.countDocuments({ ...filter, status: { $in: ['Open','In Progress'] }, dueDate: { $lt: now } }),
      Asset.countDocuments({ ...filter, 'maintenanceSchedule.nextMaintenance': { $gte: now, $lte: in30d } }),
      Consumable.countDocuments({ ...filter, expiresAt: { $gte: now, $lte: in30d } }),
    ]);

    res.json({
      assets: assetCount,
      workOrdersOpen: openWOCount,
      workOrdersOverdue: overdueWOCount,
      upcomingMaintenance: upcomingMaintCount,
      expiringConsumables: expiringConsumablesCount,
      asOf: now.toISOString(),
      windowDays: 30,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- ASSETS (READ-ONLY) ----------
portalRouter.get('/assets', async (req, res) => {
  const filter = buildTenantFilter(req);
  if (!filter) return res.status(403).json({ error: 'Forbidden' });

  const { q, page = 1, pageSize = 20 } = req.query;
  const find = { ...filter };
  if (q?.trim()) {
    find.$or = [
      { ctrlNumber:   new RegExp(q, 'i') },
      { manufacturer: new RegExp(q, 'i') },
      { model:        new RegExp(q, 'i') },
      { description:  new RegExp(q, 'i') },
      { serialNumber: new RegExp(q, 'i') },
    ];
  }

  const skip = (Number(page)-1) * Number(pageSize);
  const [items, total] = await Promise.all([
    Asset.find(find).sort({ ctrlNumber: 1 }).skip(skip).limit(Number(pageSize)),
    Asset.countDocuments(find),
  ]);
  res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
});

portalRouter.get('/assets/:id', async (req, res) => {
  const filter = buildTenantFilter(req);
  if (!filter) return res.status(403).json({ error: 'Forbidden' });

  const asset = await Asset.findOne({ ...filter, _id: req.params.id })
    .populate('maintenanceSchedule.procedure')
    .lean();
  if (!asset) return res.status(404).json({ error: 'Not found' });
  res.json(asset);
});

// ---------- MAINTENANCE (READ-ONLY + REQUEST RESCHEDULE) ----------
portalRouter.get('/maintenance/schedules', async (req, res) => {
  const filter = buildTenantFilter(req);
  if (!filter) return res.status(403).json({ error: 'Forbidden' });

  const items = await Asset.find(
    { ...filter, 'maintenanceSchedule.nextMaintenance': { $exists: true } },
    {
      ctrlNumber: 1,
      manufacturer: 1,
      model: 1,
      'maintenanceSchedule.nextMaintenance': 1,
      'maintenanceSchedule.frequency': 1,
      'maintenanceSchedule.procedure': 1,
    }
  ).populate('maintenanceSchedule.procedure', 'name');
  res.json({ items });
});

// { assetId, requestedDate, reason }
portalRouter.post('/maintenance-requests', async (req, res) => {
  const filter = buildTenantFilter(req);
  if (!filter) return res.status(403).json({ error: 'Forbidden' });

  const { assetId, requestedDate, reason } = req.body || {};
  if (!assetId || !requestedDate) {
    return res.status(400).json({ error: 'assetId and requestedDate are required' });
  }

  const asset = await Asset.findOne({ ...filter, _id: assetId }, { _id: 1 });
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const ticket = await Ticket.create({
    customerId: filter.customerId,
    type: 'MaintenanceReschedule',
    status: 'Open',
    payload: { assetId, requestedDate, reason },
    createdBy: req.user._id,
    createdByName: req.user.username,
    createdAt: new Date(),
  });

  res.status(201).json({ ok: true, ticketId: ticket._id });
});

// ---------- SERVICE REQUEST (CREATES WO WITH status: Requested) ----------
/*
Payload: { assetId, description, priority? ('Low'|'Normal'|'High') }
*/
portalRouter.post('/service-requests', async (req, res) => {
  const filter = buildTenantFilter(req);
  if (!filter) return res.status(403).json({ error: 'Forbidden' });

  const { assetId, description, priority = 'Normal' } = req.body || {};
  if (!assetId || !description) return res.status(400).json({ error: 'assetId and description are required' });

  const asset = await Asset.findOne({ ...filter, _id: assetId }, { _id: 1 });
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const wo = await WorkOrder.create({
    customerId: filter.customerId,
    assetId,
    description,
    status: 'Requested',
    workOrderType: 'Corrective Maintenance',
    priority,
    requestDate: new Date(),
    notificationsSent: false,
    createdBy: req.user._id,
    requestedByName: req.user.username,
  });

  res.status(201).json({ ok: true, workOrderId: wo._id, status: wo.status });
});

// ---------- CONSUMABLES (READ-ONLY + APPROVE REPLACE) ----------
portalRouter.get('/consumables', async (req, res) => {
  const filter = buildTenantFilter(req);
  if (!filter) return res.status(403).json({ error: 'Forbidden' });

  const now = new Date();
  const in45d = new Date(); in45d.setDate(now.getDate() + 45);

  const items = await Consumable.find({
    ...filter,
    expiresAt: { $gte: now, $lte: in45d }
  }).sort({ expiresAt: 1 });

  res.json({ items, windowDays: 45 });
});

portalRouter.post('/consumables/:id/approve', async (req, res) => {
  const filter = buildTenantFilter(req);
  if (!filter) return res.status(403).json({ error: 'Forbidden' });

  const c = await Consumable.findOne({ ...filter, _id: req.params.id });
  if (!c) return res.status(404).json({ error: 'Consumable not found' });

  // Create internal ticket for replacement; ops can convert to WO or pick list
  const ticket = await Ticket.create({
    customerId: filter.customerId,
    type: 'ConsumableReplace',
    status: 'Open',
    payload: { consumableId: c._id },
    createdBy: req.user._id,
    createdByName: req.user.username,
    createdAt: new Date(),
  });

  // Optional: set a flag so we don’t double-approve in UI
  await c.updateOne({ $set: { replacementApprovedAt: new Date(), replacementApprovedBy: req.user._id } });

  res.status(201).json({ ok: true, ticketId: ticket._id });
});

// ---------- REPORTS ----------
function toCSV(rows) {
  if (!rows?.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
  }
  return lines.join('\n');
}

// GET /portal/reports/assets?format=csv
portalRouter.get('/reports/assets', async (req, res) => {
  const filter = buildTenantFilter(req);
  if (!filter) return res.status(403).json({ error: 'Forbidden' });

  const rows = await Asset.find({ ...filter }, {
    ctrlNumber: 1, manufacturer: 1, model: 1, description: 1, serialNumber: 1,
    facility: 1, department: 1, 'maintenanceSchedule.nextMaintenance': 1
  }).lean();

  if (req.query.format === 'csv') {
    const csv = toCSV(rows.map(r => ({
      ctrlNumber: r.ctrlNumber,
      manufacturer: r.manufacturer,
      model: r.model,
      description: r.description,
      serialNumber: r.serialNumber,
      facility: r.facility,
      department: r.department,
      nextMaintenance: r?.maintenanceSchedule?.nextMaintenance || ''
    })));
    res.setHeader('Content-Disposition', 'attachment; filename="assets.csv"');
    res.type('text/csv').send(csv);
  } else {
    res.json({ items: rows });
  }
});

// GET /portal/reports/workorders?format=csv&status=Open
portalRouter.get('/reports/workorders', async (req, res) => {
  const filter = buildTenantFilter(req);
  if (!filter) return res.status(403).json({ error: 'Forbidden' });

  const { status } = req.query;
  const find = { ...filter };
  if (status) find.status = status;

  const rows = await WorkOrder.find(find, {
    workOrderNumber: 1, status: 1, workOrderType: 1, assetId: 1,
    description: 1, requestDate: 1, dueDate: 1, completionDate: 1, priority: 1
  }).populate('assetId', 'ctrlNumber manufacturer model').lean();

  const cleaned = rows.map(r => ({
    workOrderNumber: r.workOrderNumber || r._id?.toString(),
    status: r.status,
    workOrderType: r.workOrderType,
    assetCtrl: r.assetId?.ctrlNumber,
    assetMake: r.assetId?.manufacturer,
    assetModel: r.assetId?.model,
    description: r.description,
    requestDate: r.requestDate,
    dueDate: r.dueDate,
    completionDate: r.completionDate,
    priority: r.priority || 'Normal',
  }));

  if (req.query.format === 'csv') {
    const csv = toCSV(cleaned);
    res.setHeader('Content-Disposition', 'attachment; filename="workorders.csv"');
    res.type('text/csv').send(csv);
  } else {
    res.json({ items: cleaned });
  }
});

module.exports = portalRouter;