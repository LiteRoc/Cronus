//src/routers/workOrderRouter.js

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const WorkOrder = require('../models/WorkOrder');
const Asset = require('../models/Asset');
const Procedure = require('../models/Procedure');
const TaskResult = require('../models/TaskResults');
const Task = require('../models/Task');
const Ticket = require('../models/Tickets');
const Part = require('../models/Part');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');
const { deleteSubLog } = require ('../helpers/workOrderHelpers');

const { attachContractClient } = require('../middleware/forwardContractHeaders');

const router = express.Router();
const isObjectId = (id) => mongoose.isValidObjectId(id);

const CONTRACT = process.env.CONTRACT_SERVICE_URL || 'http://contract-servcie:5001';

// ---------- Helpers ----------
async function deriveFacilityIdFromAsset(assetId) {
  const asset = await Asset.findById(assetId).select('facilityId');
  return asset?.facilityId || null;
}

async function ensureTenantOwnsWorkOrder(req, res, next) {
  const { id } = req.params;
  if (!isObjectId(id)) {
    return res.status(400).json({ error: 'Invalid work order ID' });
  }

  // Validate context here so async middleware never leaks an uncaught rejection.
  const selected = (req.headers['x-facility-id'] || '').toString().trim();
  const active = selected || req.user.facilityId;
  if ((selected || req.user.role !== 'admin') && !isObjectId(active)) {
    return res.status(400).json({ error: 'Invalid Facility context' });
  }
  if (selected && req.user.role !== 'admin' &&
      !(Array.isArray(req.user.facilities) ? req.user.facilities : []).some(f => String(f?._id || f) === selected)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const filter = { _id: id, ...buildTenantFilter(req) };
    const wo = await WorkOrder.findOne(filter).select('_id facilityId');
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    req.workOrderFilter = filter;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

function subresourceError(res, error) {
  if (error.name === 'CastError' || error.name === 'ValidationError') {
    return res.status(400).json({ error: 'Invalid work order input' });
  }
  if (error.name === 'VersionError') {
    return res.status(409).json({ error: 'Work order changed; retry the request' });
  }
  if (error.name === 'DocumentNotFoundError') {
    return res.status(404).json({ error: 'Work order not found' });
  }
  return res.status(500).json({ error: 'Internal Server Error' });
}

// Keep document-save hooks, but recheck authorization on the actual write too.
function scopedSave(workOrder, req) {
  workOrder.$where = {
    ...req.workOrderFilter,
    _id: workOrder._id,
    facilityId: workOrder.facilityId || { $exists: false },
  };
  return workOrder.save();
}

const ordinaryEditFields = new Set([
  'description', 'workOrderType', 'priority', 'status',
  'scheduledDate', 'dueDate', 'completionDate',
]);

// ---------- List ----------
router.get('/', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const tf = buildTenantFilter(req);
    const {
      status, assignedTo, assetId, assetIds, q, start, end, 
      dateField = 'requestDate', 
      mode, // optional: "analytics" to avoid pagination + populates"
      page = '1', limit = '20',
    } = req.query;

    // Search and operational filters must never replace tenant authorization.
    const query = { $and: [tf], status: { $ne: 'Archived' } };

    // status filter
    if (status) query.status = status;

    // assignedTo filter
    if (assignedTo && isObjectId(assignedTo)) query.assignedTo = assignedTo;

    // asset filter ... assetIds wins if present
    //if (assetId && isObjectId(assetId)) query.assetId = assetId;
    if (assetIds) {
      const ids = String(assetIds)
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
        .filter(isObjectId);

      if (ids.length === 0) return res.status(400).json({ error: 'No valid assetIds provided' });
      query.assetId = { $in: ids };
    } else if (assetId && isObjectId(assetId)) {
      query.assetId = assetId;
    }

    // date range filter ... supports requestDate/createdAt/closedAt
    if (start || end) {
      const allowedFields = new Set(['requestDate', 'createdAt', 'closedAt']);
      const field = allowedFields.has(dateField) ? dateField : 'requestDate';

      query[field] = {
        ...(start ? { $gte: new Date(start) } : {}),
        ...(end ? { $lte: new Date(end) } : {}),
      };
    }
    // text search
    if (q) {
      query.$or = [
        { description: { $regex: q, $options: 'i' } },
        { workOrderType: { $regex: q, $options: 'i' } },
      ];
    }

    // pagination
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);

    // analytics mode (no pagination + no heavy populates)
    const isAnalytics = String(mode) === 'analytics';

    const total = await WorkOrder.countDocuments(query);

    let woQuery = WorkOrder.find(query).sort({ requestDate: -1 });

      if (!isAnalytics) {
        woQuery = woQuery
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .populate('assetId', 'ctrlNumber manufacturer model')
          .populate('assignedTo', 'username role');
      } else {
        // keep the payload light for performance calculations
        woQuery = woQuery.select(
          'assetId requestDate createdAt closedAt type workOrderType status partsUsed timeLogs travelLogs responseTimeHours dueDate'
        );
      }

    const items = await woQuery.lean();

    res.json({ 
      items, 
      total, 
      page: isAnalytics ? 1 : pageNum, 
      totalPages: isAnalytics ? 1 : Math.ceil(total / limitNum) 
    });
  } catch (err) {
    console.error('List WOs error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Get one ----------
router.get('/:id', authenticateToken, authorizeRoles('admin', 'technician'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const wo = await WorkOrder.findById(req.params.id)
      .populate('assetId', 'ctrlNumber manufacturer model')
      .populate('assignedTo', 'username role name email')
      .populate('assignedTo', 'name email')
      .populate('procedureId')
      .populate('relatedTicketId', 'status priority title')
      .populate({
        path: "partsUsed.partId",
        select: "partNumber description price quantityOnHand location",
      })
      .populate({
        path: 'testEquipmentUsed.equipmentId',
        select: 'ctrlNumber manufacturer model assetId'
      })
      .populate({
        path: 'testEquipmentUsed.usedBy',
        select: 'name email username'
      })
      .populate('contractId')
      .lean();
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    res.json(wo);
  } catch (err) {
    console.error('Get WO error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Get work orders by contract ----------
router.get("/by-contract/:contractId", authenticateToken, async (req, res) => {
    try {
      const { contractId } = req.params;
      const tenantFilter = buildTenantFilter(req);
      const { start, end, dateField = "requestDate" } = req.query;

      const query = {
        contractId,
        ...tenantFilter,
        status: { $ne: "Archived" },
      };

      if (start || end) {
        const allowedFields = new Set(["requestDate", "createdAt", "completionDate", "closedAt"]);
        const field = allowedFields.has(dateField) ? dateField : "requestDate";

        query[field] = { 
          ...(start ? { $gte: new Date(start) } : {}),
          ...(end ? { $lte: new Date(end) } : {}),
        };
      }

    const workOrders = await WorkOrder.find(query)
      .select(
        "assetId workOrderNumber type workOrderType status requestDate createdAt completionDate closedAt dueDate responseTimeHours resolutionTimeHours partsUsed timeLogs travelLogs vendorService"
      )
        .sort({ requestDate: -1 })
        .lean();

      return res.json({ workOrders });
    } catch (error) {
      console.error("Error fetching work orders by contract:", error);
      return res.status(500).json({
        message: "Server error fetching contract work orders",
        error,
      });
    }
  }
);

// ---------- Create (internal only) ----------
router.post('/', attachContractClient, authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const assetId = req.assetId || req.body.assetId;
    //console.log('AssetId is:', assetId);
    if (!assetId || !isObjectId(assetId)) return res.status(400).json({ error: 'Valid assetId is required' });

    // derive facilityId from asset (prevents cross-tenant WO creation)
    const facilityId = await deriveFacilityIdFromAsset(assetId);
    //console.log('FacilityId is:', facilityId);
    if (!facilityId) return res.status(400).json({ error: 'Asset has no facilityId' });

    // 🔧 Coerce assignedTo to an ObjectId string no matter what the client sent
    let assignedTo = req.body.assignedTo;
    if (assignedTo && typeof assignedTo === 'object') assignedTo = assignedTo._id;
    if (!assignedTo) assignedTo = req.user.id; // default to creator (admin/tech)

    const requestDate = req.body.requestDate || new Date();

    let contractId = null;
    try {
      const contractResponse = await req.contract.get(
        `/contracts/active-for-asset/${assetId}`,
        { params: {date: requestDate } } 
      );
      contractId = contractResponse.data?.contractId || null;
    } catch (err) {
        console.warn('No matching contract found or contract service unavailable:', err.message);
    }

    //console.log('Create WO → assignedTo:', assignedTo);
    const normalize = (s) => s ? (s[0].toUpperCase() + s.slice(1).toLowerCase()) : s;

    if (contractId && mongoose.isValidObjectId(contractId)) {
      req.body.contractId = mongoose.Types.ObjectId.createFromHexString(contractId);
    } else {
      req.body.contractId = null;
    }

    const wo = await WorkOrder.create({
      ...req.body,
      assignedTo,
      assetId,
      facilityId,
      status: normalize(req.body.status) || 'Open',
      priority: normalize(req.body.priority) || 'Normal',
      requestDate: req.body.requestDate || new Date(),
      createdBy: req.user.id ?? null,
      updatedBy: req.user.id ?? null,
      contractId: req.body.contractId,
    });

    res.status(201).json(wo);
  } catch (err) {
    console.error('Create WO error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 🔒 Keep auth so only real customers hit the legacy route
router.post('/request', authenticateToken, authorizeRoles('customer'), (req, res) => {
    // Optional: set a date when this endpoint will be fully removed
    const sunset = new Date();
    sunset.setMonth(sunset.getMonth() + 1); // e.g., remove in 1 month

    // RFC-style deprecation headers (informative for clients & logs)
    res.set({
      'Deprecation': 'true',                               // signals deprecated
      'Sunset': sunset.toUTCString(),                      // when it goes away
      'Link': '</tickets>; rel="alternate"',               // preferred alt
      'Migrate-To': '/tickets',                            // helpful custom header
    });

    // Helpful JSON payload
    return res.status(410).json({
      error: 'DeprecatedEndpoint',
      message: 'POST /workorders/request is deprecated. Use POST /tickets instead.',
      migrateTo: '/tickets',
      examples: {
        service: {
          method: 'POST',
          path: '/tickets',
          body: {
            type: 'service',
            subject: 'Service request for asset',
            description: 'Noise from pump head',
            assetId: '64f9e2...'
          }
        },
        consumable: {
          method: 'POST',
          path: '/tickets',
          body: {
            type: 'consumable',
            subject: 'Replace filter',
            description: 'Monthly filter change',
            assetId: '64f9e2...',
            partId: '6501ab...',
            quantity: 2
          }
        }
      }
    });
  }
);

// Promote a Ticket into a Work Order
router.post('/from-ticket/:ticketId', authenticateToken, authorizeRoles('admin', 'tech'), // customers should NOT create WOs directly
  async (req, res) => {
    try {
    const { ticketId } = req.params;

    const facilityId = req.headers['x-facility-id'];
    const ticket = await Ticket.findOne({ ticketId, ...buildTenantFilter(req) });

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (ticket.status === 'converted' && ticket.relatedWorkOrderId) {
        const existing = await WorkOrder.findById(ticket.relatedWorkOrderId);
        return res.status(200).json({ workOrder: existing, message: 'Ticket already converted' });
      }

      // Map ticket → work order
    const woPayload = {
      facilityId,
      departmentId: ticket.departmentId,
      assetId: ticket.assetId ?? undefined,
      description: ticket.description || ticket.subject,
      workOrderType: ticket.type === 'consumable' ? 'Consumable' : 'Corrective Maintenance',
      status: 'Open',
      requestDate: new Date(),
      dueDate: undefined,
      scheduledDate: undefined,
      createdFrom: 'ticket',
      ticketId: ticket._id,
      createdBy: req.user._id,
      requestedBy: ticket.requestedBy || null,
    };

      const workOrder = await WorkOrder.create({...woPayload });
      const createdWO = workOrder[0];

      // keep a backlink for convenience (optional but useful)
      ticket.workOrderId = createdWO._id;
      ticket.status = 'converted';
      await ticket.save();

      return res.status(201).json({ message: 'Work order created from ticket', workOrder: createdWO, workOrder, ticket });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error('from-ticket error', err);
      return res.status(500).json({ error: 'CreateFromTicketFailed' });
    }
  }
);

// ---------- Update (internal only) ----------
router.put('/:id', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length === 0 ||
        Object.keys(body).some(key => !ordinaryEditFields.has(key)) ||
        body.status === 'Archived') {
      return res.status(400).json({ error: 'Invalid ordinary work order update' });
    }
    const patch = Object.fromEntries(Object.entries(body));

    const updated = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req) },
      { $set: { ...patch, updatedBy: req.user.id } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Work order not found' });
    res.json({ message: 'Work order updated', workOrder: updated });
  } catch (err) {
    return subresourceError(res, err);
  }
});

// ---------- Assign (internal) ----------
router.patch('/:id/assign', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { assignedTo } = req.body || {};
    if (!assignedTo || !isObjectId(assignedTo)) return res.status(400).json({ error: 'Valid assignedTo is required' });

    const updated = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req) },
      { assignedTo, updatedBy: req.user.id },
      { new: true }
    ).populate('assignedTo', 'username role');
    res.json({ message: 'Assigned', workOrder: updated });
  } catch (err) {
    console.error('Assign WO error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Status update (internal) ----------
router.patch('/:id/status', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status is required' });

    const patch = { status, updatedBy: req.user.id };
    if (status === 'Completed') patch.completionDate = new Date();

    const updated = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req) },
      patch,
      { new: true }
    );
    res.json({ message: 'Status updated', workOrder: updated });
  } catch (err) {
    console.error('Status WO error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Schedule (internal) ----------
router.patch('/:id/schedule', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { scheduledDate, dueDate } = req.body || {};
    const updated = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req) },
      { ...(scheduledDate ? { scheduledDate } : {}), ...(dueDate ? { dueDate } : {}), updatedBy: req.user.id },
      { new: true }
    );
    res.json({ message: 'Schedule updated', workOrder: updated });
  } catch (err) {
    console.error('Schedule WO error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Time logs (internal) ----------
router.post('/:id/time-logs', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { timeSpent, description } = req.body || {};
    if (!timeSpent || timeSpent <= 0) return res.status(400).json({ error: 'timeSpent must be > 0' });

    const updated = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req) },
      { $push: { timeLogs: { userId: req.user.id, timeSpent, description, createdAt: new Date() } }, $set: { updatedBy: req.user.id } },
      { new: true }
    );
    res.json({ message: 'Time logged', workOrder: updated });
  } catch (err) {
    console.error('Time log error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Remove Time log (uses deleteSubLog helper) ---------
router.delete(
  "/:id/time-logs/:logId", 
  authenticateToken, 
  authorizeRoles("admin", "tech"), 
  ensureTenantOwnsWorkOrder,
  (req, res) => deleteSubLog(req, res, "timeLogs")
);

// ---------- Travel logs (internal) ----------
router.post('/:id/travel-logs', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { travelTime, note } = req.body || {};
    if (!travelTime || travelTime <= 0) return res.status(400).json({ error: 'travelTime must be > 0' });

    const updated = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req) },
      { $push: { travelLogs: { userId: req.user.id, travelTime, note, createdAt: new Date() } }, $set: { updatedBy: req.user.id } },
      { new: true }
    );
    res.json({ message: 'Travel logged', workOrder: updated });
  } catch (err) {
    console.error('Travel log error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Remove Travel log (uses deleteSublog helper) --------
router.delete(
  "/:id/travel-logs/:logId", 
  authenticateToken, 
  authorizeRoles("admin", "tech"), 
  ensureTenantOwnsWorkOrder,
  (req, res) => deleteSubLog(req, res, "travelLogs")
);

// ---------- Attach procedure (internal) ----------
router.patch('/:id/procedure', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { id } = req.params;
    const { procedureId } = req.body || {};
    if (!isObjectId(procedureId)) return res.status(400).json({ error: 'Invalid procedureId' });

    const proc = await Procedure.findById(procedureId).populate('tasks', 'description type unitOfMeasure');
    if (!proc) return res.status(404).json({ error: 'Procedure not found' });

    // Initialize blank taskResults from procedure.tasks
    const taskResults = (proc.tasks || []).map(t => ({
      taskId: t._id,
      label: t.description,
      type: t.type.toLowerCase(),           // "pass/fail" | "measurement" | "comment"
      unitOfMeasure: t.unitOfMeasure || null,
      value: null,
      passed: null,
      comment: '',
    }));

    // Create new procedure subdoc
    const procedureEntry = {
      _id: proc._id,
      name: proc.name,
      taskResults,
    };

    // Use $addToSet to prevent duplicates
    const updated = await WorkOrder.findOneAndUpdate(
      { _id: id, ...buildTenantFilter(req) },
      {
        $addToSet: { procedures: { _id: proc._id, name: proc.name, taskResults } },
        $set: { updatedBy: req.user.id }
      },
      { new: true }
    );

    res.json({ message: 'Procedure attached', workOrder: updated });
  } catch (err) {
    console.error('Attach procedure error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Update task results (internal) ----------
router.patch('/:id/procedure/:procedureId/task-results', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, 
  async (req, res) => {
  try {
    const { id, procedureId } = req.params;
    const { taskResults } = req.body || {};
    if (!Array.isArray(taskResults)) return res.status(400).json({ error: 'taskResults array required' });

    if (!isObjectId(procedureId) || taskResults.some(tr =>
      !tr || typeof tr !== 'object' || Array.isArray(tr) || !isObjectId(tr.taskId))) {
      return res.status(400).json({ error: 'Invalid procedure or task ID' });
    }
    if (!await Procedure.exists({ _id: procedureId })) {
      return res.status(404).json({ error: 'Procedure not found' });
    }
    const taskIds = [...new Set(taskResults.map(tr => String(tr.taskId)))];
    if (await Task.countDocuments({ _id: { $in: taskIds } }) !== taskIds.length) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const normalizeType = (t) => {
      if (!t) return null;
      const val = t.toString().toLowerCase();
      if (val.includes("pass")) return "pass/fail";
      if (val.includes("measure")) return "measurement";
      if (val.includes("comment")) return "comment";
      return val;
    };

    const cleanedResults = taskResults.map((tr) => ({
        ...tr,
        type: normalizeType(tr.type),
        submittedBy: req.user.id,
        submittedAt: new Date(),
      }));

    const updated = await WorkOrder.findOneAndUpdate(
      { 
        _id: new mongoose.Types.ObjectId(id), 
        'procedures._id': new mongoose.Types.ObjectId(procedureId), 
        ...buildTenantFilter(req) },
      { $set: { 'procedures.$.taskResults': cleanedResults, updatedBy: req.user.id } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Work order or procedure not found' });

    // Sync results into TaskResult collection
      for (const tr of cleanedResults) {
        await TaskResult.findOneAndUpdate(
          { workOrderId: id, taskId: tr.taskId },
          {
            ...tr,
            workOrderId: id,
            procedureId,
          },
          { upsert: true, new: true }
        );
      }

    res.json({ message: 'Task results updated', workOrder: updated });
  } catch (err) {
    return subresourceError(res, err);
  }
});

// ---------- Soft delete (archive) — admin only ----------
router.patch('/:id/archive', authenticateToken, authorizeRoles('admin'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const updated = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req) },
      { $set: { deletedAt: new Date(), deletedBy: req.user.id, status: 'Archived', updatedBy: req.user.id } },
      { new: true }
    );
    res.json({ message: 'Work order archived', workOrder: updated });
  } catch (err) {
    console.error('Archive WO error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE: Remove procedure from work order ... update with deleteSubLog helper
router.delete('/:id/procedure/:procedureId',
  authenticateToken,
  authorizeRoles('admin','tech'),
  ensureTenantOwnsWorkOrder,
  async (req, res) => {
    try {
      const { id, procedureId } = req.params;

      // Ensure it's a valid ObjectId
      if (!isObjectId(procedureId)) {
        return res.status(400).json({ error: 'Invalid procedureId' });
      }

      const updated = await WorkOrder.findOneAndUpdate(
        {
          _id: id,
          ...buildTenantFilter(req),
          'procedures._id': procedureId, // make sure the work order has this procedure
        },
        {
          $pull: { procedures: { _id: new mongoose.Types.ObjectId(procedureId) } },
          $set: { updatedBy: req.user.id },
        },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Work order or procedure not found' });
      }

      res.json({ message: 'Procedure removed', workOrder: updated });
    } catch (err) {
      console.error('Remove procedure error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

// =====================================================
// GET /workorders/:id/parts
// =====================================================
router.get('/:id/parts', authenticateToken, authorizeRoles('admin', 'technician'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOne(req.workOrderFilter)
      .populate({
        path: 'partsUsed.partId',
        select: 'partNumber description price location supplierId manufacturerId',
        populate: [
          { path: 'supplierId', select: 'name' },
          { path: 'manufacturerId', select: 'name' },
        ],
      })
      .lean();

    if (!workOrder) return res.status(404).json({ error: 'Work order not found' });

    res.json(workOrder.partsUsed || []);
  } catch (error) {
    return subresourceError(res, error);
  }
});

// =====================================================
// POST /workorders/:id/parts
// =====================================================
router.post('/:id/parts', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  const { partId, quantity, note } = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(partId)) {
    return res.status(400).json({ error: 'Invalid partId' });
  }

  try {
    const workOrder = await WorkOrder.findOne(req.workOrderFilter);
    if (!workOrder) return res.status(404).json({ error: 'Work order not found' });

    // Optionally verify part exists
    const part = await Part.findById(partId);
    if (!part) return res.status(404).json({ error: 'Part not found' });

    // Add new part usage
    const newUsage = {
      partId,
      quantity,
      note: note || '',
      usedBy: req.user.id,
      usedAt: new Date(),
    };

    workOrder.partsUsed.push(newUsage);
    await scopedSave(workOrder, req);

    res.status(201).json({ message: 'Part added successfully', part: newUsage });
  } catch (error) {
    return subresourceError(res, error);
  }
});

// =====================================================
// PUT /workorders/:id/parts/:partId
// =====================================================
router.put('/:id/parts/:partId', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  const { quantity, note } = req.body || {};
  if (!isObjectId(req.params.partId)) return res.status(400).json({ error: 'Invalid partId' });

  try {
    const workOrder = await WorkOrder.findOne(req.workOrderFilter);
    if (!workOrder) return res.status(404).json({ error: 'Work order not found' });

    const partUsage = workOrder.partsUsed.find(
      (pu) => pu.partId.toString() === req.params.partId
    );

    if (!partUsage) return res.status(404).json({ error: 'Part not found on this work order' });

    if (quantity !== undefined) partUsage.quantity = quantity;
    if (note !== undefined) partUsage.note = note;
    partUsage.usedBy = req.user.id;
    partUsage.usedAt = new Date();

    await scopedSave(workOrder, req);

    res.json({ message: 'Part updated successfully', part: partUsage });
  } catch (error) {
    return subresourceError(res, error);
  }
});

// =====================================================
// DELETE /workorders/:id/parts/:partId
// =====================================================
router.delete('/:id/parts/:partId', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  if (!isObjectId(req.params.partId)) return res.status(400).json({ error: 'Invalid partId' });
  try {
    const workOrder = await WorkOrder.findOne(req.workOrderFilter);
    if (!workOrder) return res.status(404).json({ error: 'Work order not found' });

    const beforeCount = workOrder.partsUsed.length;
    workOrder.partsUsed = workOrder.partsUsed.filter(
      (pu) => pu.partId.toString() !== req.params.partId
    );

    if (workOrder.partsUsed.length === beforeCount) {
      return res.status(404).json({ error: 'Part not found on this work order' });
    }

    await scopedSave(workOrder, req);

    res.json({ message: 'Part removed successfully' });
  } catch (error) {
    return subresourceError(res, error);
  }
});

// POST: add test equipment to work order
router.post("/:id/test-equipment", authenticateToken, authorizeRoles('admin', 'technician'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { equipmentId, note } = req.body || {};
    const userId = req.user.id;
    if (!isObjectId(equipmentId)) return res.status(400).json({ error: 'Invalid equipment ID' });

    const workOrder = await WorkOrder.findOne(req.workOrderFilter);
    if (!workOrder) return res.status(404).json({ error: "Work order not found" });

    // No cross-Facility equipment/loaner exception. Global admin scope does not
    // permit an Asset from a different Facility than the authorized parent.
    const equipment = workOrder.facilityId && await Asset.exists({
      _id: equipmentId,
      $and: [buildTenantFilter(req), { facilityId: workOrder.facilityId }],
    });
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });

    workOrder.testEquipmentUsed.push({
      equipmentId,
      usedBy: userId,
      usedAt: new Date(),
      note,
    });

    await scopedSave(workOrder, req);

    // Active callers revalidate the WO; do not return unrelated nested data.
    res.json({ message: 'Test equipment added' });
  } catch (error) {
    return subresourceError(res, error);
  }
});

// DELETE: remove test equipment entry
router.delete("/:id/test-equipment/:equipmentId", authenticateToken, authorizeRoles('admin', 'technician'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { equipmentId } = req.params;
    if (!isObjectId(equipmentId)) return res.status(400).json({ error: 'Invalid equipment ID' });
    const workOrder = await WorkOrder.findOne(req.workOrderFilter);
    if (!workOrder) return res.status(404).json({ error: "Work order not found" });

    workOrder.testEquipmentUsed = workOrder.testEquipmentUsed.filter(
      (te) => te.equipmentId.toString() !== equipmentId
    );

    await scopedSave(workOrder, req);

    res.json({ message: "Test equipment removed" });
  } catch (error) {
    return subresourceError(res, error);
  }
});

module.exports = router;

module.exports = router;
