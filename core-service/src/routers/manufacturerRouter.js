// routes/manufacturerRouter.js
const express = require('express');
const Manufacturer = require('../models/Manufacturer');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const lifecycle = require('../services/referenceLifecycle');
const businessFields = ['name', 'contactName', 'email', 'phone', 'address', 'website', 'status'];
const debug = require('debug')('app:manufacturerRouter');

const router = express.Router();

// =====================================================
// GET: All manufacturers
// =====================================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const manufacturers = await Manufacturer.find({ deletedAt: null }).lean();
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
    const fields = lifecycle.businessFields(req.body, businessFields);
    const manufacturer = new Manufacturer({
      ...fields,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });
    await manufacturer.save();
    res.status(201).json({ message: 'Manufacturer created successfully', manufacturer });
  } catch (error) {
    debug('Error creating manufacturer:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Manufacturer name must be unique' });
    } else {
      lifecycle.respond(res, error, 'Failed to create manufacturer');
    }
  }
});

// =====================================================
// PUT: Update manufacturer
// =====================================================
router.put('/:id', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const fields = lifecycle.businessFields(req.body, businessFields);
    const manufacturer = await lifecycle.updateActive(Manufacturer, req.params.id, fields, req.user.id);
    res.json({ message: 'Manufacturer updated successfully', manufacturer });
  } catch (error) {
    debug('Error updating manufacturer:', error);
    lifecycle.respond(res, error, 'Failed to update manufacturer');
  }
});

// =====================================================
// PATCH: Soft delete / archive manufacturer
// =====================================================
router.patch('/:id/archive', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const archived = await lifecycle.archive(Manufacturer, req.params.id, req.user.id, 'Inactive');
    res.json({ message: 'Manufacturer archived', archived });
  } catch (error) {
    debug('Error archiving manufacturer:', error);
    lifecycle.respond(res, error, 'Failed to archive manufacturer');
  }
});

module.exports = router;