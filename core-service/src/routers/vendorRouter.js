const express = require('express');
const Vendor = require('../models/Vendor');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const vendorRouter = express.Router();
const adminOnly = authorizeRoles('admin');
const active = { archivedAt: null }; // Includes legacy records without archive fields.
const validId = value => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
const contactFields = { contactName: 'primaryContact', email: 'email', phone: 'phone', address: 'address', website: 'website' };
const mutable = new Set(['name', 'category', 'services', 'territories', 'preferredVendor', 'notes', 'contactInfo', ...Object.keys(contactFields)]);
const sharedSelection = '_id name category contactInfo services territories';

function project(vendor, role) {
  const result = { _id: vendor._id, name: vendor.name };
  for (const key of ['category', 'services', 'territories']) {
    if (vendor[key] !== undefined) result[key] = vendor[key];
  }
  for (const [key, stored] of Object.entries(contactFields)) {
    if (vendor.contactInfo?.[stored] !== undefined) result[key] = vendor.contactInfo[stored];
  }
  if (role === 'admin') {
    for (const key of ['preferredVendor', 'notes']) if (vendor[key] !== undefined) result[key] = vendor[key];
  }
  return result;
}
function selection(role) {
  return sharedSelection + (role === 'admin' ? ' preferredVendor notes' : '');
}
function invalid(res) { return res.status(400).json({ error: 'Invalid Vendor request' }); }
function failure(res, error) {
  if (['ValidationError', 'CastError', 'StrictModeError'].includes(error?.name)) return invalid(res);
  return res.status(500).json({ error: 'Vendor operation failed' });
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function changes(body) {
  if (!object(body) || !Object.keys(body).length) return null;
  const patch = {};
  for (const [key, value] of Object.entries(body)) {
    if (!mutable.has(key)) return null;
    if (key === 'contactInfo') {
      // Accept the existing input shape, but never arbitrary nested fields/operators.
      if (!object(value) || !Object.keys(value).length) return null;
      for (const [nested, entry] of Object.entries(value)) {
        if (!Object.values(contactFields).includes(nested) || typeof entry !== 'string') return null;
        patch[`contactInfo.${nested}`] = entry;
      }
    } else if (Object.hasOwn(contactFields, key)) {
      if (typeof value !== 'string' || Object.hasOwn(body.contactInfo || {}, contactFields[key])) return null;
      patch[`contactInfo.${contactFields[key]}`] = value;
    } else {
      if (['services', 'territories'].includes(key)) {
        if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')) return null;
      } else if (key === 'preferredVendor') {
        if (typeof value !== 'boolean') return null;
      } else if (typeof value !== 'string') return null;
      patch[key] = value;
    }
  }
  return patch;
}

// Handles JSON parser errors passed from app.js without exposing parser internals.
function vendorJsonErrorHandler(error, _req, res, next) {
  if (error?.type === 'entity.parse.failed') return invalid(res);
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Vendor request too large' });
  return next(error);
}
vendorRouter.use(authenticateToken, authorizeRoles('admin', 'technician'));
vendorRouter.param('id', (req, res, next, id) => validId(id) ? next() : invalid(res));

vendorRouter.get('/', async (req, res) => {
  try {
    const vendors = await Vendor.find(active).select(selection(req.user.role)).lean();
    return res.json(vendors.map(v => project(v, req.user.role)));
  } catch (error) { return failure(res, error); }
});

// Historical display only: stable ID/name, no management fields or tenant metadata.
// New VendorLink validation must continue to use the active-only detail endpoint.
vendorRouter.get('/:id/history', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).select('_id name').lean();
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    return res.json({ _id: vendor._id, name: vendor.name });
  } catch (error) { return failure(res, error); }
});
vendorRouter.get('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, ...active }).select(selection(req.user.role)).lean();
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    return res.json(project(vendor, req.user.role));
  } catch (error) { return failure(res, error); }
});
vendorRouter.post('/', adminOnly, (req, res) => {
  if (req.body !== undefined && !object(req.body)) return invalid(res);
  return res.status(409).json({
    error: 'Vendor creation is unavailable pending Vendor ownership normalization',
  });
});
vendorRouter.put('/:id', adminOnly, async (req, res) => {
  const patch = changes(req.body);
  if (!patch) return invalid(res);
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, ...active });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    // Validate the whole existing document, not only changed paths. Never repair tenancy.
    try { await vendor.validate(); } catch (error) {
      if (error?.name !== 'ValidationError') throw error;
      return res.status(409).json({ error: 'Vendor requires data normalization before update' });
    }
    for (const [key, value] of Object.entries(patch)) vendor.set(key, value);
    await vendor.validate();
    // Apply only validated mutable fields; a concurrent archive cannot be undone.
    const updated = await Vendor.findOneAndUpdate({ _id: req.params.id, ...active },
      { $set: patch }, { new: true, runValidators: true }).select(selection(req.user.role)).lean();
    if (!updated) return res.status(404).json({ error: 'Vendor not found' });
    return res.json({ message: 'Vendor updated', vendor: project(updated, req.user.role) });
  } catch (error) { return failure(res, error); }
});
vendorRouter.delete('/:id', adminOnly, async (req, res) => {
  if (!validId(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
  if (req.body !== undefined && (!object(req.body) || Object.keys(req.body).length)) return invalid(res);
  try {
    // Deliberately validate only the archive update: legacy missing tenancy must not
    // prevent preserving references. Existing tenantId and business fields stay intact.
    const archived = await Vendor.findOneAndUpdate({ _id: req.params.id, ...active },
      { $set: { archivedAt: new Date(), archivedBy: req.user.id } },
      { new: true, runValidators: true, timestamps: false }).select('_id').lean();
    if (!archived) return res.status(404).json({ error: 'Vendor not found' });
    return res.json({ message: 'Vendor archived' });
  } catch (error) { return failure(res, error); }
});

vendorRouter.use((error, _req, res, _next) => {
  if (error instanceof URIError) return invalid(res);
  return failure(res, error);
});
vendorRouter.vendorJsonErrorHandler = vendorJsonErrorHandler;
module.exports = vendorRouter;
