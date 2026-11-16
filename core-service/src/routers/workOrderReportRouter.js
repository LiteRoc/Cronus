const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const ownership = require('../services/operationalOwnership');
const WorkOrder = require('../models/WorkOrder');
const Asset = require('../models/Asset');
const Facility = require('../models/Facility');
const { parseFilters, queryFor, buildReport } = require('../services/workOrderReport');
const router = express.Router();
router.get('/', authenticateToken, authorizeRoles('admin', 'technician'), async (req, res) => {
  try {
    const filters = parseFilters(req.query), facilityId = await ownership.selectedFacility(req);
    const workOrders = await WorkOrder.find(queryFor(facilityId, filters))
      .select('_id assetId workOrderNumber status priority workOrderType description requestDate scheduledDate dueDate completionDate timeLogs travelLogs partsUsed vendorService economics costs')
      .sort(filters.mode === 'open' ? { requestDate: 1, _id: 1 } : { completionDate: -1, _id: -1 }).limit(5001).maxTimeMS(10000).lean();
    if (workOrders.length > 5000) return res.status(413).json({ error: 'Report exceeds 5000 Work Orders. Narrow the filters; no partial report was generated.' });
    const ids = [...new Set(workOrders.map(r => String(r.assetId)).filter(v => /^[a-f\d]{24}$/i.test(v)))];
    const assets = ids.length ? await Asset.find({ _id: { $in: ids }, facilityId, deletedAt: null }).select('_id ctrlNumber manufacturer model').maxTimeMS(10000).lean() : [];
    const facility = await Facility.findById(facilityId).select('_id name').maxTimeMS(10000).lean();
    if (!facility) return res.status(404).json({ error: 'Hospital not found' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(buildReport({ facility, filters, workOrders, assets }));
  } catch (error) {
    if (error instanceof ownership.OwnershipError) return ownership.respond(res, error);
    if (error.status === 400) return res.status(400).json({ error: error.message });
    return res.status(503).json({ error: 'Work Order report unavailable. Please try again.' });
  }
});
module.exports = router;
