const Asset = require('../models/Asset');
const { buildTenantFilter } = require('../middleware/tenantScope');

async function deriveCustomerIdFromAsset(assetId) {
  const asset = await Asset.findById(assetId).select('customerId');
  return asset?.customerId || null;
}

async function ensureTenantOwnsWorkOrder(req, res, next) {
  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ error: 'Invalid work order ID' });
  const wo = await WorkOrder.findOne({ _id: id, ...buildTenantFilter(req) }).select('_id');
  if (!wo) return res.status(404).json({ error: 'Work order not found' });
  next();
}

module.exports = { deriveCustomerIdFromAsset, ensureTenantOwnsWorkOrder };