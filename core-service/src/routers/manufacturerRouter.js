// routes/manufacturerRouter.js
const express = require('express');
const mongoose = require('mongoose');
const Manufacturer = require('../models/Manufacturer');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');
const debug = require('debug')('app:manufacturerRouter');

const router = express.Router();

// =====================================================
// GET: All manufacturers
// =====================================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tf = buildTenantFilter(req);
    const manufacturers = await Manufacturer.find(tf).lean();
    res.json(manufacturers);
  } catch (error) {
    debug('Error fetching manufacturers:', error);
    res.status(500).json({ error: 'Failed to fetch manufacturers' });
  }
});

// =====================================================
// POST: Create manufacturer
// =====================================================
router.post('/', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const manufacturer = new Manufacturer({
      ...req.body,
      createdBy: req.user.id,
    });
    await manufacturer.save();
    res.status(201).json({ message: 'Manufacturer created successfully', manufacturer });
  } catch (error) {
    debug('Error creating manufacturer:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Manufacturer name must be unique' });
    } else {
      res.status(500).json({ error: 'Failed to create manufacturer' });
    }
  }
});

// =====================================================
// PUT: Update manufacturer
// =====================================================
router.put('/:id', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const manufacturer = await Manufacturer.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user.id,
      },
      { new: true }
    );
    if (!manufacturer) return res.status(404).json({ error: 'Manufacturer not found' });
    res.json({ message: 'Manufacturer updated successfully', manufacturer });
  } catch (error) {
    debug('Error updating manufacturer:', error);
    res.status(500).json({ error: 'Failed to update manufacturer' });
  }
});

// =====================================================
// PATCH: Soft delete / archive manufacturer
// =====================================================
router.patch('/:id/archive', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const archived = await Manufacturer.findByIdAndUpdate(
      req.params.id,
      { $set: { deletedAt: new Date(), deletedBy: req.user.id, status: 'Inactive' } },
      { new: true }
    );
    if (!archived) return res.status(404).json({ error: 'Manufacturer not found' });
    res.json({ message: 'Manufacturer archived', archived });
  } catch (error) {
    debug('Error archiving manufacturer:', error);
    res.status(500).json({ error: 'Failed to archive manufacturer' });
  }
});

module.exports = router;