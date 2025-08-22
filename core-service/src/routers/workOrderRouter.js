const express = require('express');
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
const Asset = require('../models/Asset');
const Procedure = require('../models/Procedure');
const Ticket = require('../models/Tickets');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');

const router = express.Router();
const isObjectId = (id) => mongoose.isValidObjectId(id);

// ---------- Helpers ----------
async function deriveCustomerIdFromAsset(assetId) {
  const asset = await Asset.findById(assetId).select('customerId');
  return asset?.customerId || null;
}

async function ensureTenantOwnsWorkOrder(req, res, next) {
  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ error: 'Invalid work order ID' });
  const wo = await WorkOrder.findOne({ _id: id, ...buildTenantFilter(req) }).select('_id');
  if (!wo) return res.status(404).json({ error: 'Work order not found' });
  next();
}

// ---------- List ----------
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tf = buildTenantFilter(req);
    const {
      status, assignedTo, assetId, q, start, end,
      page = '1', limit = '20',
    } = req.query;

    const query = { ...tf, status: { $ne: 'Archived' } };
    if (status) query.status = status;
    if (assignedTo && isObjectId(assignedTo)) query.assignedTo = assignedTo;
    if (assetId && isObjectId(assetId)) query.assetId = assetId;
    if (start || end) {
      query.requestDate = {
        ...(start ? { $gte: new Date(start) } : {}),
        ...(end   ? { $lte: new Date(end)   } : {}),
      };
    }
    if (q) {
      query.$or = [
        { description: { $regex: q, $options: 'i' } },
        { workOrderType: { $regex: q, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);

    const total = await WorkOrder.countDocuments(query);
    const items = await WorkOrder.find(query)
      .sort({ requestDate: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('assetId', 'ctrlNumber manufacturer model')
      .populate('assignedTo', 'username role')
      .lean();

    res.json({ items, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('List WOs error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Get one ----------
router.get('/:id', authenticateToken, ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const wo = await WorkOrder.findById(req.params.id)
      .populate('assetId', 'ctrlNumber manufacturer model')
      .populate('assignedTo', 'username role')
      .lean();
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    res.json(wo);
  } catch (err) {
    console.error('Get WO error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Create (internal only) ----------
router.post('/', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const { assetId } = req.body || {};
    if (!assetId || !isObjectId(assetId)) return res.status(400).json({ error: 'Valid assetId is required' });

    // derive customerId from asset (prevents cross-tenant WO creation)
    const customerId = await deriveCustomerIdFromAsset(assetId);
    if (!customerId) return res.status(400).json({ error: 'Asset has no customerId' });

    const wo = await WorkOrder.create({
      ...req.body,
      customerId,
      status: req.body.status || 'Open',
      requestDate: req.body.requestDate || new Date(),
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    res.status(201).json(wo);
  } catch (err) {
    console.error('Create WO error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Customer: Request Service ----------
/*router.post('/request', authenticateToken, authorizeRoles('customer'), async (req, res) => {
  try {
    const { assetId, description, priority } = req.body || {};
    if (!assetId || !isObjectId(assetId)) return res.status(400).json({ error: 'Valid assetId is required' });

    // enforce tenant owns asset
    const owned = await Asset.exists({ _id: assetId, customerId: req.user.customerId });
    if (!owned) return res.status(404).json({ error: 'Asset not found' });

    const wo = await WorkOrder.create({
      assetId,
      customerId: req.user.customerId,
      description: description || 'Service requested by customer',
      priority: priority || 'Normal',
      status: 'Requested',
      requestDate: new Date(),
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    res.status(201).json({ message: 'Service request created', workOrder: wo });
  } catch (err) {
    console.error('WO request error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});*/
// 🔒 Keep auth so only real customers hit the legacy route
router.post(
  '/request',
  authenticateToken,
  authorizeRoles('customer'),
  (req, res) => {
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
router.post(
  '/from-ticket/:ticketId',
  authenticateToken,
  authorizeRoles('admin', 'tech'), // customers should NOT create WOs directly
  async (req, res) => {
    const { ticketId } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const ticket = await Ticket.findById(ticketId).session(session);
      if (!ticket) {
        return res.status(404).json({ error: 'TicketNotFound', message: `No ticket ${ticketId}` });
      }
      if (ticket.status === 'closed' || ticket.status === 'resolved') {
        return res.status(409).json({ error: 'TicketClosed', message: 'Ticket already resolved/closed' });
      }

      // Map ticket → work order (adjust field names to your models)
      const woPayload = {
        assetId: ticket.assetId ?? undefined,
        description: ticket.description || ticket.subject,
        workOrderType: ticket.type === 'consumable' ? 'Consumable' : 'Corrective Maintenance',
        status: 'Open',
        requestDate: new Date(),
        dueDate: undefined,            // let your existing default/dueDate logic set this
        scheduledDate: undefined,
        createdFrom: 'ticket',
        ticketId: ticket._id,
        requestedBy: ticket.requestedBy || null,
        // If you want: copy priority, facility/department, part request details, etc.
      };

      const workOrder = await WorkOrder.create([woPayload], { session });
      const createdWO = workOrder[0];

      // keep a backlink for convenience (optional but useful)
      ticket.workOrderId = createdWO._id;
      ticket.status = 'in_progress';   // or 'converted'
      await ticket.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({ message: 'Work order created from ticket', workOrder: createdWO });
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
    const updated = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req) },
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Work order not found' });
    res.json({ message: 'Work order updated', workOrder: updated });
  } catch (err) {
    console.error('Update WO error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
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
      { $push: { timeLogs: { userId: req.user.id, timeSpent, description } }, $set: { updatedBy: req.user.id } },
      { new: true }
    );
    res.json({ message: 'Time logged', workOrder: updated });
  } catch (err) {
    console.error('Time log error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Travel logs (internal) ----------
router.post('/:id/travel-logs', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { travelTime, note } = req.body || {};
    if (!travelTime || travelTime <= 0) return res.status(400).json({ error: 'travelTime must be > 0' });

    const updated = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req) },
      { $push: { travelLogs: { userId: req.user.id, travelTime, note } }, $set: { updatedBy: req.user.id } },
      { new: true }
    );
    res.json({ message: 'Travel logged', workOrder: updated });
  } catch (err) {
    console.error('Travel log error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Attach procedure (internal) ----------
router.put('/:id/procedure/:procedureId', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { id, procedureId } = req.params;
    if (!isObjectId(procedureId)) return res.status(400).json({ error: 'Invalid procedureId' });

    const proc = await Procedure.findById(procedureId).select('name tasks');
    if (!proc) return res.status(404).json({ error: 'Procedure not found' });

    // initialize taskResults from procedure tasks
    const taskResults = (proc.tasks || []).map(t => ({
      taskId: t._id,
      label: t.name,
      type: t.type,
      unitOfMeasure: t.unitOfMeasure || null,
      value: null,
      passed: null,
      comment: '',
    }));

    const updated = await WorkOrder.findOneAndUpdate(
      { _id: id, ...buildTenantFilter(req) },
      { procedure: { _id: proc._id, name: proc.name, taskResults }, updatedBy: req.user.id },
      { new: true }
    );
    res.json({ message: 'Procedure attached', workOrder: updated });
  } catch (err) {
    console.error('Attach procedure error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------- Update task results (internal) ----------
router.patch('/:id/procedure/:procedureId/task-results', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { id, procedureId } = req.params;
    const { taskResults } = req.body || {};
    if (!Array.isArray(taskResults)) return res.status(400).json({ error: 'taskResults array required' });

    const updated = await WorkOrder.findOneAndUpdate(
      { _id: id, 'procedure._id': procedureId, ...buildTenantFilter(req) },
      { $set: { 'procedure.taskResults': taskResults, updatedBy: req.user.id } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Work order or procedure not found' });
    res.json({ message: 'Task results updated', workOrder: updated });
  } catch (err) {
    console.error('Task results error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
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

module.exports = router;