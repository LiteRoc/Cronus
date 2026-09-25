const costMutations = require('../services/workOrderCosts/mutate');
const costEngine = require('../services/workOrderCosts/calculate');
const ownership = require('../services/operationalOwnership');
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
// All existing response shapes retain their operational fields; economic values
// are serialized through the legacy-safe adapter, including mutation responses.
router.use((req,res,next)=>{
  const json=res.json.bind(res);
  function adapt(value) {
    if (!value || typeof value !== 'object') return value;
    if (value.toObject) value=value.toObject();
    if (Array.isArray(value)) return value.map(adapt);
    if (value._id && (Array.isArray(value.timeLogs) || Array.isArray(value.partsUsed)) && value.assetId) return costEngine.serialize(value);
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k, ['items','workOrders','workOrder'].includes(k)?adapt(v):v]));
  }
  res.json=value=>json(adapt(value)); next();
});
const isObjectId = (id) => mongoose.isValidObjectId(id);

const CONTRACT = process.env.CONTRACT_SERVICE_URL || 'http://contract-servcie:5001';

// ---------- Helpers ----------
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
  if (error.status) return res.status(error.status).json({error:error.message});
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
          'assetId requestDate createdAt closedAt type workOrderType status partsUsed timeLogs travelLogs vendorService economics costs responseTimeHours dueDate'
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
        "assetId workOrderNumber type workOrderType status requestDate createdAt completionDate closedAt dueDate responseTimeHours resolutionTimeHours partsUsed timeLogs travelLogs vendorService economics costs"
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
const createFields = ['assetId','facilityId','departmentId','assignedTo','description','workOrderType',
  'priority','status','requestDate','scheduledDate','dueDate','completionDate','requestedBy','vendorService'];
const protectedCreateFields = ['_id','ticketId','createdFrom','createdBy','updatedBy','createdAt','updatedAt',
  'economics','importIdentity','importProvenance','costRepairHistory','deletedAt','deletedBy','workOrderNumber','timeLogs','travelLogs','partsUsed','testEquipmentUsed','procedures','costs'];
router.post('/', attachContractClient, authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    ownership.object(req.body);
    if (protectedCreateFields.some(key => Object.hasOwn(req.body, key))) ownership.fail(400, 'Protected creation field');
    const facilityId = await ownership.selectedFacility(req);
    ownership.agreeFacility(req.body, facilityId);
    const input = ownership.pick(req.body, createFields);
    const asset = await ownership.reference(Asset, input.assetId, { facilityId });
    if (Object.hasOwn(input, 'departmentId')) input.departmentId = await ownership.department(input.departmentId, facilityId);
    input.assignedTo = input.assignedTo
      ? await ownership.assignee(input.assignedTo?._id || input.assignedTo, facilityId)
      : await ownership.defaultAssignee(req.user.id, facilityId);
    const normalize = value => {
      if (value == null || value === '') return undefined;
      if (typeof value !== 'string') ownership.fail(400, 'Invalid status or priority');
      return value.toLowerCase();
    };
    const statuses = { open: 'Open', 'in progress': 'In Progress', completed: 'Completed', requested: 'Requested' };
    const priorities = { low: 'Low', normal: 'Normal', high: 'High', critical: 'Critical' };
    const status = normalize(input.status), priority = normalize(input.priority);
    if ((status && !statuses[status]) || (priority && !priorities[priority])) ownership.fail(400, 'Invalid status or priority');
    const requestDate = input.requestDate || new Date();
    if (!Number.isFinite(new Date(requestDate).getTime())) ownership.fail(400, 'Invalid request date');
    if (input.vendorService != null) input.vendorService = ownership.pick(input.vendorService,
      ['vendorId','vendorName','vendorWorkOrderNumber','laborHours','travelHours','laborCost','travelCost','partsCost',
       'shippingCost','totalCost','invoiceNumber','poNumber','sourceDocument'], true);
    let contractId = null;
    try {
      const response = await req.contract.get(`/contracts/active-for-asset/${asset._id}`, { params: { date: requestDate } });
      if (typeof response.data?.contractId === 'string' && /^[a-f\d]{24}$/i.test(response.data.contractId)) contractId = response.data.contractId;
    } catch (_) { /* Existing unavailable/no-contract behavior remains null. */ }
    const wo = await costMutations.createNative({ ...input, assetId: asset._id, facilityId, assignedTo: input.assignedTo,
      status: statuses[status] || 'Open', priority: priorities[priority] || 'Normal', requestDate,
      contractId, createdFrom: 'manual', createdBy: req.user.id, updatedBy: req.user.id });
    res.status(201).json(wo);
  } catch (error) { return ownership.respond(res, error); }
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

// Promote an Approved Ticket and establish its backlink atomically.
router.post('/from-ticket/:ticketId', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  let session;
  try {
    ownership.id(req.params.ticketId);
    const body = ownership.pick(req.body || {}, ['assetId', 'facilityId'], true);
    const facilityId = await ownership.selectedFacility(req);
    ownership.agreeFacility(body, facilityId);
    session = await mongoose.startSession();
    let created;
    await session.withTransaction(async () => {
      await ownership.selectedFacility(req, session);
      const ticket = await Ticket.findOne({ _id: req.params.ticketId, facilityId, deletedAt: null, status: { $ne: 'Closed' } }).session(session);
      if (!ticket) ownership.fail(404, 'Ticket not found');
      if (ticket.workOrderId) ownership.fail(409, 'Ticket already has a Work Order');
      if (ticket.status !== 'Approved') ownership.fail(409, 'Ticket is not approved for promotion');
      if (!ticket.assetId) ownership.fail(400, 'Ticket requires an Asset');
      if (Object.hasOwn(body, 'assetId') && String(body.assetId) !== String(ticket.assetId)) ownership.fail(400, 'Conflicting Asset');
      const asset = await ownership.reference(Asset, String(ticket.assetId), { facilityId }, session);
      const departmentId = ticket.departmentId
        ? await ownership.department(String(ticket.departmentId), facilityId, session) : undefined;
      created = await costMutations.createNative({
        assetId: asset._id, facilityId, departmentId,
        description: ticket.description || ticket.subject,
        workOrderType: ticket.type === 'consumable' ? 'Consumable' : 'Corrective Maintenance',
        priority: ticket.priority || 'Normal', status: 'Open', requestDate: new Date(),
        createdFrom: 'ticket', ticketId: ticket._id, requestedBy: ticket.requestedBy,
        createdBy: req.user.id, updatedBy: req.user.id,
      }, { session });
      ticket.status = 'Converted';
      ticket.workOrderId = created._id;
      ticket.updatedBy = req.user.id;
      await ticket.save({ session });
    });
    res.status(201).json({ message: 'Work order created from ticket', workOrder: created });
  } catch (error) {
    if (error.code === 20 || error.code === 303) return res.status(503).json({ error: 'Ticket promotion unavailable' });
    return ownership.respond(res, error);
  } finally { if (session) await session.endSession(); }
});

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
      { _id: req.params.id, ...buildTenantFilter(req), deletedAt: null },
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
    const parent = await WorkOrder.findOne(req.workOrderFilter).select('facilityId deletedAt');
    if (!parent || parent.deletedAt) ownership.fail(404, 'Work order not found');
    await ownership.assignee(assignedTo, parent.facilityId);

    const updated = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req), deletedAt: null },
      { assignedTo, updatedBy: req.user.id },
      { new: true }
    ).populate('assignedTo', 'username role');
    if (!updated) return res.status(404).json({ error: 'Work order not found' });
    res.json({ message: 'Assigned', workOrder: updated });
  } catch (err) {
    console.error('Assign WO error:', err);
    return ownership.respond(res, err);
  }
});

// ---------- Status update (internal) ----------
router.patch('/:id/status', authenticateToken, authorizeRoles('admin', 'tech'), ensureTenantOwnsWorkOrder, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['Open','In Progress','Completed','Requested'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const patch = { status, updatedBy: req.user.id };
    if (status === 'Completed') patch.completionDate = new Date();

    const updated = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req), deletedAt: null },
      patch,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Work order not found' });
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
      { _id: req.params.id, ...buildTenantFilter(req), deletedAt: null },
      { ...(scheduledDate ? { scheduledDate } : {}), ...(dueDate ? { dueDate } : {}), updatedBy: req.user.id },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Work order not found' });
    res.json({ message: 'Schedule updated', workOrder: updated });
  } catch (err) {
    console.error('Schedule WO error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Economic log writes use one scoped compare-and-set path.
for (const [path, field, allowed] of [
  ['time-logs','timeLogs',['timeSpent','description','workDate']],
  ['travel-logs','travelLogs',['travelTime','note','workDate']],
]) {
  router.post(`/:id/${path}`, authenticateToken, authorizeRoles('admin','tech'), ensureTenantOwnsWorkOrder, async(req,res)=>{
    try {
      const body=ownership.pick(req.body,allowed,true);
      const {workOrder}=await costMutations.mutate(req.workOrderFilter,req.user,async w=>{
        if(field==='timeLogs') w.timeLogs.push(await costMutations.labor(w,body,req.user));
        else {
          if(!costEngine.finite(body.travelTime)||body.travelTime<1) ownership.fail(400,'Invalid travel minutes');
          const workDate=await require('../services/internalCostRates').workDate(w.facilityId,body.workDate);
          w.travelLogs.push({_id:new mongoose.Types.ObjectId(),userId:req.user.id,travelTime:body.travelTime,note:body.note||'',createdAt:new Date(),workDate,travelCost:null,pricing:{basis:'unknown',unknownReason:'travel_policy_unapproved'}});
        }
      });
      res.json({message:'Time logged',workOrder});
    } catch(e){return subresourceError(res,e);}
  });
  router.delete(`/:id/${path}/:logId`, authenticateToken, authorizeRoles('admin','tech'), ensureTenantOwnsWorkOrder, async(req,res)=>{
    try {
      if(!isObjectId(req.params.logId)) ownership.fail(400,'Invalid log ID');
      const {workOrder}=await costMutations.mutate(req.workOrderFilter,req.user,w=>{
        const index=w[field].findIndex(e=>String(e._id)===req.params.logId);
        if(index<0) ownership.fail(404,'Log not found');
        w[field].splice(index,1);
      });
      res.json({message:'Log deleted',workOrder});
    }catch(e){return subresourceError(res,e);}
  });
}

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
      { _id: req.params.id, ...buildTenantFilter(req), deletedAt: null },
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

router.post('/:id/parts',authenticateToken,authorizeRoles('admin','tech'),ensureTenantOwnsWorkOrder,async(req,res)=>{
  try {
    const body=ownership.pick(req.body,['partId','quantity','note'],true);
    const {result}=await costMutations.mutate(req.workOrderFilter,req.user,async w=>{
      const entry=await costMutations.part(w,body,req.user); w.partsUsed.push(entry); return entry;
    });
    res.status(201).json({message:'Part added successfully',part:result});
  }catch(e){return subresourceError(res,e);}
});
function partMutation(remove, byUsage) { return async(req,res)=>{
  try {
    const id=req.params.partId||req.params.usageId;
    if(!isObjectId(id)) ownership.fail(400,'Invalid Part usage ID');
    const body=remove?{}:ownership.pick(req.body,['quantity','note'],true);
    const {result}=await costMutations.mutate(req.workOrderFilter,req.user,w=>{
      const matches=w.partsUsed.map((p,i)=>({p,i})).filter(({p})=>String(byUsage?p._id:p.partId)===id);
      if(!matches.length) ownership.fail(404,'Part not found on work order');
      if(matches.length!==1) ownership.fail(409,'Multiple usages; address a usage ID');
      const {p,i}=matches[0];
      if(remove) {w.partsUsed.splice(i,1);return;}
      const entry={...p};
      if(body.quantity!==undefined) {
        if(!costEngine.finite(body.quantity)||body.quantity<1) ownership.fail(400,'Invalid quantity');
        entry.quantity=body.quantity;
        if(body.quantity!==p.quantity) {
          if(costEngine.trusted(p.pricing,p.unitCost)) entry.extendedCost=costEngine.amount(body.quantity,p.unitCost);
          else {
            entry.pricing={...p.pricing,basis:'unknown',unknownReason:'historical_authority_missing',
              legacyOriginal:p.pricing?.legacyOriginal || {quantity:p.quantity,unitCost:p.unitCost,extendedCost:p.extendedCost}};
            entry.extendedCost=null;
          }
        }
      }
      if(body.note!==undefined) entry.note=body.note;
      w.partsUsed[i]=entry; return entry;
    });
    res.json({message:remove?'Part removed successfully':'Part updated successfully',...(remove?{}:{part:result})});
  }catch(e){return subresourceError(res,e);}
}; }
for(const [path,usage] of [['parts/:partId',false],['part-usages/:usageId',true]]) {
  router.put(`/:id/${path}`,authenticateToken,authorizeRoles('admin','tech'),ensureTenantOwnsWorkOrder,partMutation(false,usage));
  router.delete(`/:id/${path}`,authenticateToken,authorizeRoles('admin','tech'),ensureTenantOwnsWorkOrder,partMutation(true,usage));
}

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
