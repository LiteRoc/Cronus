const express = require('express');
const mongoose = require('mongoose');
const Part = require('../models/Part');
const debug = require('debug')('app:partRouter');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const Manufacturer = require('../models/Manufacturer');
const lifecycle = require('../services/referenceLifecycle');
const businessFields = ['partNumber', 'description', 'price', 'quantityOnHand', 'location',
  'supplierId', 'manufacturerId', 'compatibleAssets', 'status'];

async function withManufacturerReference(fields, previous, destinationId, write) {
  if (fields.manufacturerId == null) return write(null);
  lifecycle.id(fields.manufacturerId);
  // Preserve historical references without letting a stale read restore a link.
  if (previous?.manufacturerId?.toString() === fields.manufacturerId.toLowerCase()) {
    delete fields.manufacturerId;
    return write(null);
  }
  return lifecycle.withReservation(Manufacturer, fields.manufacturerId,
    previous ? 'part-manufacturer-update' : 'part-create', destinationId, write);
}

const partRouter = express.Router();

// GET: List parts
partRouter.get('/', authenticateToken, async (req, res) => {
  const { assetId } = req.query;

  try {
    const filter = {
      deletedAt: null,
      ...(assetId && mongoose.Types.ObjectId.isValid(assetId)
        ? { compatibleAssets: assetId }
        : {}),
    };

    const parts = await Part.find(filter).lean();
    res.json(parts);
  } catch (error) {
    debug('Error fetching parts:', error);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
});

// POST: Create a new part
partRouter.post('/', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const fields = lifecycle.businessFields(req.body, businessFields);
    const { supplierId } = fields;
    if (supplierId && !mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({ error: 'Invalid supplier ID' });
    }

    const destinationId = new mongoose.Types.ObjectId();
    const created = new Part({ ...fields, _id: destinationId, createdBy: req.user.id, updatedBy: req.user.id });
    await created.validate();
    const part = await withManufacturerReference(fields, null, String(destinationId), async handle => {
      if (handle) {
        Object.assign(created, lifecycle.destinationStamp(handle));
        handle.writeStarted = true;
      }
      return created.save(handle ? { w: 1, j: true } : {});
    });
    res.status(201).json({ message: 'Part created successfully', part });
  } catch (error) {
    debug('Error creating part:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Part number must be unique' });
    } else {
      lifecycle.respond(res, error, 'Failed to create part');
    }
  }
});

// PUT: Update a part
partRouter.put('/:id', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const fields = lifecycle.businessFields(req.body, businessFields);
    const previous = await lifecycle.activeRecord(Part, req.params.id);
    const part = await withManufacturerReference(fields, previous, req.params.id, handle =>
      lifecycle.updateActive(Part, req.params.id, fields, req.user.id, handle));
    res.json({ message: 'Part updated successfully', part });
  } catch (error) {
    debug('Error updating part:', error);
    lifecycle.respond(res, error, 'Failed to update part');
  }
});

// PATCH: Soft delete / archive part
partRouter.patch('/:id/archive', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const archived = await lifecycle.archive(Part, req.params.id, req.user.id, 'Retired');
    res.json({ message: 'Part archived', archived });
  } catch (error) {
    debug('Error archiving part:', error);
    lifecycle.respond(res, error, 'Failed to archive part');
  }
});

// POST: Customer approval (placeholder)
partRouter.post('/:id/approve', authenticateToken, authorizeRoles('customer'), async (req, res) => {
  const { reason, workOrderId } = req.body || {};
  res.json({ message: 'Approval recorded', partId: req.params.id, workOrderId, reason });
});

module.exports = partRouter;