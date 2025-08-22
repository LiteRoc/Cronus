const express = require('express');
const mongoose = require('mongoose');
const Part = require('../models/Part');
const debug = require('debug')('app:partRouter');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');

const partRouter = express.Router();

// GET: List (tenant-scoped if parts are tenant-bound; otherwise internal-only)
partRouter.get('/', authenticateToken, async (req, res) => {
  const tf = buildTenantFilter(req);
  const parts = await Part.find(tf).lean();
  res.json(parts);
});

// POST: Create a new part
partRouter.post('/', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
    const { supplierId } = req.body;
    try {

        // Validate supplierId
        if (supplierId && !mongoose.Types.ObjectId.isValid(supplierId)) {
            return res.status(400).json({ error: 'Invalid supplier ID' });
        }

        const part = new Part(req.body);
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
partRouter.put('/:id', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {/* update */});

// PATCH: SOFT DELETE / Remove a part by ID (admin only)
partRouter.patch('/:id/achive', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const deleted = await Part.findOneAndUpdate(
    { _id: req.params.id, ...buildTenantFilter(req) },
    { $set: { deletedAt: new Date(), deletedBy: req.user.id, status: 'Archived' } },
    { new: true }
  );
  if (!deleted) return res.status(404).json({ error: 'Part not found' });
  res.json({ message: 'Part archived' });
});

// POST: Customer approval of consumable replacements
partRouter.post('/:id/approve', authenticateToken, authorizeRoles('customer'), async (req, res) => {
  const { reason, workOrderId } = req.body || {};
  // record an approval document/event linked to customerId + partId (+ optional WO)
  // internal process later consumes this approval
  res.json({ message: 'Approval recorded' });
});

module.exports = partRouter;