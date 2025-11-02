const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
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

async function deleteSubLog(req, res, fieldPath) {
  try {
    const { id, logId } = req.params;
    const woObjectId = new mongoose.Types.ObjectId(id);

    // 1️⃣ Load fresh work order (unleaned document)
    let workOrder = await WorkOrder.findById(woObjectId);
    if (!workOrder) {
      console.warn('Work order not found:', id);
      return res.status(404).json({ message: 'Work order not found' });
    }

    // 2️⃣ Resolve nested field safely
    const parts = fieldPath.split('.');
    let fieldRef = workOrder;
    for (const part of parts) {
      if (fieldRef[part] === undefined || fieldRef[part] === null) {
        console.warn(`Invalid field path: ${fieldPath}`);
        return res.status(400).json({ message: `Invalid field path: ${fieldPath}` });
      }
      fieldRef = fieldRef[part];
    }

    if (!Array.isArray(fieldRef)) {
      console.warn(`Field is not an array: ${fieldPath}`);
      return res.status(400).json({ message: `Field ${fieldPath} is not an array` });
    }

    // 3️⃣ Diagnostic logging
    console.log(`Attempting to delete from "${fieldPath}"`);
    console.log('Incoming logId:', logId);
    console.log('Existing IDs:', fieldRef.map((item) => item._id.toString()));

    const originalCount = fieldRef.length;

    // 4️⃣ Filter array
    const filtered = fieldRef.filter((item) => item._id.toString() !== logId);

    if (filtered.length === originalCount) {
      console.warn(`No ${fieldPath} matched for deletion: ${logId}`);
      return res.status(404).json({ message: `${fieldPath} entry not found` });
    }

    // 5️⃣ Assign new array and mark as modified
    let parent = workOrder;
    for (let i = 0; i < parts.length - 1; i++) {
      parent = parent[parts[i]];
    }
    parent[parts[parts.length - 1]] = filtered;

    // Mark modified explicitly
    workOrder.markModified(fieldPath);
    workOrder.updatedBy = req.user.id;

    // 6️⃣ Save (forcing Mongoose to write fresh)
    workOrder = await WorkOrder.findByIdAndUpdate(
      woObjectId,
      { $set: { [fieldPath]: filtered, updatedBy: req.user.id } },
      { new: true }
    );

    console.log(`${fieldPath} entry deleted successfully`);
    res.status(200).json({ message: `${fieldPath} entry deleted`, workOrder });
  } catch (err) {
    console.error(`Error deleting ${fieldPath}:`, err);
    res.status(500).json({ message: `Error deleting ${fieldPath}` });
  }
}

module.exports = { deriveCustomerIdFromAsset, ensureTenantOwnsWorkOrder, deleteSubLog };