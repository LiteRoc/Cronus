// facilityRouter.js
const express = require('express');
const Facility = require('../models/Facility');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const facilityRouter = express.Router();

// GET: get all facilities
facilityRouter.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const facilities = await Facility.find().lean();
    res.json(facilities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

module.exports = facilityRouter;