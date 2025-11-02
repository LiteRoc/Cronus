// src/routers/ticketRouter.js

const express = require('express');
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Asset = require('../models/Asset');
const WorkOrder = require('../models/WorkOrder');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');

const router = express.Router();
const isOid = mongoose.isValidObjectId;

// List (tenant-scoped)
router.get('/', authenticateToken, async (req, res) => {
  const tf = buildTenantFilter(req);
  const { type, status, assetId, q, page='1', limit='20' } = req.query;
  const query = { ...tf, status: { $ne: 'Archived' } };
  if (type) query.type = type;
  if (status) query.status = status;
  if (assetId && isOid(assetId)) query.assetId = assetId;
  if (q) query.$or = [{ subject: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }];

  const p = Math.max(parseInt(page,10)||1,1);
  const l = Math.min(Math.max(parseInt(limit,10)||20,1),200);

  const total = await Ticket.countDocuments(query);
  const items = await Ticket.find(query)
    .sort({ createdAt: -1 })
    .skip((p-1)*l)
    .limit(l)
    .populate('assetId','ctrlNumber manufacturer model')
    .populate('partId','sku name')
    .lean();

  res.json({ items, total, page:p, totalPages: Math.ceil(total/l) });
});

// Get one (customer can see own only; admin/tech any scoped)
router.get('/:id',  authenticateToken, async (req, res, next) => {
    try {
      const ticket = await Ticket.findOne({ _id: req.params.id, ...buildTenantFilter(req) })
        .populate('assetId', 'name manufacturer model')
        .populate('createdBy', 'name email')
        .populate('relatedWorkOrderId', 'workOrderNumber status');
      if (!ticket) return res.status(404).json({ error: 'Not found' });
      if (req.user.role === 'customer' && ticket.createdBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      res.json(ticket);
    } catch (err) {
      next(err);
    }
  }
);

// Create ticket — customer or internal
router.post('/', authenticateToken, async (req, res, next) => {

  try {
      const { facilityId } = req.headers['x-facility-id'] ? { facilityId: req.headers['x-facility-id'] } : {};
      const body = { ...req.body, facilityId, createdBy: req.user._id };
      const ticket = await Ticket.create({ ...body });
      res.status(201).json(ticket);
    } catch (err) {
      next(err);
    }
});

// Update status/priority (internal)
router.patch('/:id', authenticateToken, authorizeRoles('admin','user'), async (req, res) => {
  const { id } = req.params;
  if (!isOid(id)) return res.status(400).json({ error: 'Invalid ticket id' });

  const updated = await Ticket.findOneAndUpdate(
    { _id: id, ...buildTenantFilter(req) },
    { ...req.body, updatedBy: req.user.id },
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: 'Ticket not found' });
  res.json(updated);
});

// Customer approves consumable (moves to Approved)
router.post('/:id/approve', authenticateToken, authorizeRoles('customer'), async (req, res) => {
  const { id } = req.params;
  if (!isOid(id)) return res.status(400).json({ error: 'Invalid ticket id' });

  const updated = await Ticket.findOneAndUpdate(
    { _id: id, facilityId: req.user.facilityId, type: 'consumable', status: { $in: ['Open','Needs Info'] } },
    { $set: { status: 'Approved', updatedBy: req.user.id } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: 'Ticket not found or not approvable' });
  res.json({ message: 'Approved', ticket: updated });
});

// Convert to Work Order (internal)
router.post('/:id/convert', authenticateToken, authorizeRoles('admin','user'), async (req, res) => {
  const { id } = req.params;
  if (!isOid(id)) return res.status(400).json({ error: 'Invalid ticket id' });

  const ticket = await Ticket.findOne({ _id: id, ...buildTenantFilter(req), status: { $ne: 'Converted' } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  // Build WO description/fields from the ticket
  const description = ticket.type === 'consumable'
    ? `[Consumable] ${ticket.subject}\n${ticket.description || ''}`
    : ticket.description || ticket.subject;

  // Derive customer from ticket
  const wo = await WorkOrder.create({
    customerId: ticket.customerId,
    assetId: ticket.assetId,
    description,
    status: 'Open', // or 'Requested' if you want an internal triage step after convert
    priority: ticket.priority || 'Normal',
    requestDate: new Date(),
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  const updatedTicket = await Ticket.findByIdAndUpdate(
    ticket._id,
    { $set: { status: 'Converted', workOrderId: wo._id, updatedBy: req.user.id } },
    { new: true }
  );

  res.status(201).json({ message: 'Ticket converted', workOrder: wo, ticket: updatedTicket });
});

// Archive ticket (admin)
router.patch('/:id/archive', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  if (!isOid(id)) return res.status(400).json({ error: 'Invalid ticket id' });

  const updated = await Ticket.findOneAndUpdate(
    { _id: id, ...buildTenantFilter(req) },
    { $set: { deletedAt: new Date(), deletedBy: req.user.id, status: 'Closed', updatedBy: req.user.id } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ message: 'Ticket archived', ticket: updated });
});

module.exports = router;