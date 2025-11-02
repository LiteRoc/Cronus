const express = require('express');
const mongoose = require('mongoose');
const Part = require('../models/Part');
const debug = require('debug')('app:partRouter');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');

const partRouter = express.Router();

// GET: List parts
partRouter.get('/', authenticateToken, async (req, res) => {
  const { assetId } = req.query;

  try {
    const filter = {
      ...buildTenantFilter(req),
      ...(assetId && mongoose.Types.ObjectId.isValid(assetId)
        ? { compatibleAssets: assetId }
        : {}),
    };
    console.log("🔎 Tenant filter:", filter);

    const parts = await Part.find(filter).lean();
    console.log("🧩 Found parts:", parts.length);
    res.json(parts);
  } catch (error) {
    debug('Error fetching parts:', error);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
});

// POST: Create a new part
partRouter.post('/', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  const { supplierId } = req.body;
  try {
    if (supplierId && !mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({ error: 'Invalid supplier ID' });
    }

    const part = new Part({
      ...req.body,
      createdBy: req.user.id,
      facilityId: req.user.facilityId
    });

    await part.save();
    res.status(201).json({ message: 'Part created successfully', part });
  } catch (error) {
    debug('Error creating part:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Part number must be unique' });
    } else {
      res.status(500).json({ error: 'Failed to create part' });
    }
  }
});

// PUT: Update a part
partRouter.put('/:id', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const part = await Part.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user.id,
      },
      { new: true }
    );

    if (!part) return res.status(404).json({ error: 'Part not found' });
    res.json({ message: 'Part updated successfully', part });
  } catch (error) {
    debug('Error updating part:', error);
    res.status(500).json({ error: 'Failed to update part' });
  }
});

// PATCH: Soft delete / archive part
partRouter.patch('/:id/archive', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const archived = await Part.findOneAndUpdate(
      { _id: req.params.id, ...buildTenantFilter(req) },
      { $set: { deletedAt: new Date(), deletedBy: req.user.id, status: 'Retired' } },
      { new: true }
    );
    if (!archived) return res.status(404).json({ error: 'Part not found' });
    res.json({ message: 'Part archived', archived });
  } catch (error) {
    debug('Error archiving part:', error);
    res.status(500).json({ error: 'Failed to archive part' });
  }
});

// POST: Customer approval (placeholder)
partRouter.post('/:id/approve', authenticateToken, authorizeRoles('customer'), async (req, res) => {
  const { reason, workOrderId } = req.body || {};
  res.json({ message: 'Approval recorded', partId: req.params.id, workOrderId, reason });
});

module.exports = partRouter;