const Vendor = require('../models/Vendor');

// GET - get all Vendors
exports.getAllVendors = async (req, res) => {
    try {
    const vendors = await Vendor.find().lean();
    res.status(200).json(vendors);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
};

// GET - get a single Vendor
exports.getOneVendor = async (req, res) => {
    try {
    const vendor = await Vendor.findById(req.params.id).lean();
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.status(200).json(vendor);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
};

// POST - create a new Vendor
exports.creatVendor = async (req, res) => {
    try {
    const newVendor = new Vendor(req.body);
    await newVendor.save();
    res.status(201).json({ message: 'Vendor created', vendor: newVendor });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create vendor', details: err.message });
  }
};

// PUT - update a Vendor
exports.updateVendor = async (req, res) => {
    try {
    const updated = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Vendor not found' });
    res.status(200).json({ message: 'Vendor updated', vendor: updated });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update vendor', details: err.message });
  }
};

// DELETE - delete a Vendor
exports.deleteVendor = async (req, res) => {
    try {
    const deleted = await Vendor.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Vendor not found' });
    res.status(200).json({ message: 'Vendor deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
};