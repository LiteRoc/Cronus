const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const ownership = require('../services/operationalOwnership');
const WorkOrder = require('../models/WorkOrder'), Asset = require('../models/Asset'), Facility = require('../models/Facility');
const { parseFilters, queries, buildReport } = require('../services/monthEndReport');
const router = express.Router();
router.get('/', authenticateToken, authorizeRoles('admin', 'technician'), async (req, res) => {
  try {
    const generatedAt = new Date(), filters = parseFilters(req.query, generatedAt), facilityId = await ownership.selectedFacility(req), q = queries(facilityId, filters);
    const projection = '_id assetId workOrderNumber status priority workOrderType description requestDate scheduledDate dueDate completionDate timeLogs travelLogs partsUsed vendorService economics costs';
    const completed = await WorkOrder.find(q.completed).select(projection).sort({ completionDate: 1, _id: 1 }).limit(5001).maxTimeMS(10000).lean();
    if (completed.length > 5000) return res.status(413).json({ error: 'Monthly activity exceeds 5000 Work Orders; no partial report generated.' });
    const backlog = await WorkOrder.find(q.backlog).select(projection).sort({ requestDate: 1, _id: 1 }).limit(5001).maxTimeMS(10000).lean();
    if (backlog.length > 5000) return res.status(413).json({ error: 'Current backlog exceeds 5000 Work Orders; no partial report generated.' });
    const ids = [...new Set([...completed, ...backlog].map(r => String(r.assetId)).filter(v => /^[a-f\d]{24}$/i.test(v)))];
    const assets = ids.length ? await Asset.find({ _id: { $in: ids }, facilityId, deletedAt: null }).select('_id ctrlNumber manufacturer model').maxTimeMS(10000).lean() : [];
    const facility = await Facility.findById(facilityId).select('_id name').maxTimeMS(10000).lean();
    if (!facility) return res.status(404).json({ error: 'Hospital not found' });
    res.setHeader('Cache-Control', 'no-store'); return res.json(buildReport({ facility, filters, completed, backlog, assets, generatedAt }));
  } catch (error) {
    if (error instanceof ownership.OwnershipError) return ownership.respond(res, error);
    if (error.status === 400) return res.status(400).json({ error: error.message });
    return res.status(503).json({ error: 'Month-end report unavailable. Please try again.' });
  }
});
module.exports = router;
