const express = require('express');
const Vendor = require('../models/Vendor');
const vendorRouter = express.Router();

// GET all vendors
vendorRouter.get('/', async (req, res) => {
  try {
    const vendors = await Vendor.find().lean();
    res.status(200).json(vendors);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// GET a single vendor
vendorRouter.get('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).lean();
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.status(200).json(vendor);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

// CREATE a new vendor
vendorRouter.post('/', async (req, res) => {
  try {
    const newVendor = new Vendor(req.body);
    await newVendor.save();
    res.status(201).json({ message: 'Vendor created', vendor: newVendor });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create vendor', details: err.message });
  }
});

// UPDATE a vendor
vendorRouter.put('/:id', async (req, res) => {
  try {
    const updated = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Vendor not found' });
    res.status(200).json({ message: 'Vendor updated', vendor: updated });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update vendor', details: err.message });
  }
});

// DELETE a vendor
vendorRouter.delete('/:id', async (req, res) => {
  try {
    const deleted = await Vendor.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Vendor not found' });
    res.status(200).json({ message: 'Vendor deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

module.exports = vendorRouter;