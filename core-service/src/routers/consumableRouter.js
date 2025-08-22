const express = require('express');
const mongoose = require('mongoose');
const Consumable = require('../models/Consumable');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');

const router = express.Router();
const isOid = mongoose.isValidObjectId;

// ---------- List ----------
router.get('/', authenticateToken, authorizeRoles('admin', 'user'), async (req, res) => {
  const tf = buildTenantFilter(req);
  const { q, assetId, page = 1, limit = 20 } = req.query;
  const query = { ...tf };
  if (q) query.name = { $regex: q, $options: 'i' };
  if (assetId && isOid(assetId)) query.assetId = assetId;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const items = await Consumable.find(query)
    .sort({ expiresAt: 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('assetId', 'ctrlNumber manufacturer model')
    .lean();

  const total = await Consumable.countDocuments(query);
  res.json({ items, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
});

// ---------- Get One ----------
router.get('/:id', authenticateToken, authorizeRoles('admin', 'user'), async (req, res) => {
  const tf = buildTenantFilter(req);
  const item = await Consumable.findOne({ _id: req.params.id, ...tf }).populate('assetId').lean();
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// ---------- Create ----------
router.post('/', authenticateToken, authorizeRoles('admin', 'user'), async (req, res) => {
  const tf = buildTenantFilter(req);
  const data = {
    ...req.body,
    customerId: tf.customerId,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  };
  const created = await Consumable.create(data);
  res.status(201).json({ message: 'Created', consumable: created });
});

// ---------- Update ----------
router.put('/:id', authenticateToken, authorizeRoles('admin', 'user'), async (req, res) => {
  const updated = await Consumable.findOneAndUpdate(
    { _id: req.params.id, ...buildTenantFilter(req) },
    { ...req.body, updatedBy: req.user.id },
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Updated', consumable: updated });
});

// ---------- Delete (Soft) ----------
router.patch('/:id/archive', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const updated = await Consumable.findOneAndUpdate(
    { _id: req.params.id, ...buildTenantFilter(req) },
    { deletedAt: new Date(), deletedBy: req.user.id },
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Archived', consumable: updated });
});

module.exports = router;