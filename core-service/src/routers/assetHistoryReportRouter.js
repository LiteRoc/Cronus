const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const ownership = require('../services/operationalOwnership');
const Asset = require('../models/Asset');
const WorkOrder = require('../models/WorkOrder');
const Facility = require('../models/Facility');
const Department = require('../models/Department');
const Part = require('../models/Part');
const { parseFilters, buildReport } = require('../services/assetHistoryReport');
const router = express.Router();
router.get('/', authenticateToken, authorizeRoles('admin', 'technician'), async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const facilityId = await ownership.selectedFacility(req);
    const assets = await Asset.find({ facilityId, deletedAt: null, ...(filters.assetId ? { _id: filters.assetId } : { ctrlNumber: filters.controlNumber }) })
      .select('_id ctrlNumber manufacturer model description serialNumber equipmentClass status isArchived locationNote departmentId acquisitionDate installationDate serviceStartDate retirementDate maintenanceSchedule')
      .limit(2).maxTimeMS(10000).lean();
    if (!assets.length) return res.status(404).json({ error: 'Asset not found in selected hospital' });
    if (assets.length !== 1) return res.status(409).json({ error: 'Asset identity is ambiguous; use its Asset ID' });
    const asset = assets[0];
    const query = { assetId: asset._id, facilityId, deletedAt: null };
    if (filters.startDate) query.requestDate = { $gte: new Date(`${filters.startDate}T00:00:00.000Z`), $lt: new Date(+new Date(`${filters.endDate}T00:00:00.000Z`) + 86400000) };
    const workOrders = await WorkOrder.find(query)
      .select('_id workOrderNumber requestDate completionDate workOrderType status description timeLogs travelLogs partsUsed vendorService economics costs')
      .sort({ requestDate: -1, _id: -1 }).limit(1001).maxTimeMS(10000).lean();
    if (workOrders.length > 1000) return res.status(413).json({ error: 'History exceeds 1000 Work Orders. Narrow the date range; no partial history was generated.' });
    const partIds = [...new Set(workOrders.flatMap(row => Array.isArray(row.partsUsed) ? row.partsUsed.filter(Boolean).map(part => String(part.partId ?? '')) : []).filter(value => /^[a-f\d]{24}$/i.test(value)))];
    if (partIds.length > 5000) return res.status(413).json({ error: 'Too many part references. Narrow the history date range.' });
    const facility = await Facility.findById(facilityId).select('_id name').lean();
    if (!facility) return res.status(404).json({ error: 'Hospital not found' });
    const department = /^[a-f\d]{24}$/i.test(String(asset.departmentId ?? '')) ? await Department.findOne({ _id: asset.departmentId, facilityId }).select('_id name').lean() : null;
    const parts = partIds.length ? await Part.find({ _id: { $in: partIds }, deletedAt: null }).select('_id partNumber description').maxTimeMS(10000).lean() : [];
    const report = buildReport({ asset, facility, department, workOrders, parts, filters });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(report);
  } catch (error) {
    if (error instanceof ownership.OwnershipError) return ownership.respond(res, error);
    if (error.status === 400) return res.status(400).json({ error: error.message });
    return res.status(503).json({ error: 'Asset history report unavailable. Please try again.' });
  }
});
module.exports = router;
