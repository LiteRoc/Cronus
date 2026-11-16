const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const ownership = require('../services/operationalOwnership');
const Asset = require('../models/Asset');
const Facility = require('../models/Facility');
const Department = require('../models/Department');

const router = express.Router();
const MAX_ROWS = 5000;
const statuses = new Set(['Active', 'Inactive', 'Pending', 'Retired']);
const date = value => value && Number.isFinite(+new Date(value)) ? new Date(value).toISOString() : null;
const text = value => typeof value === 'string' ? value : '';
function input(message) { throw new ownership.OwnershipError(400, message); }
function filters(query) {
  if (Object.keys(query).some(key => !['departmentId', 'status', 'archive', 'q', 'equipmentClass'].includes(key))) input('Unsupported report filter');
  for (const value of Object.values(query)) if (typeof value !== 'string' || value.length > 120) input('Invalid report filter');
  const result = Object.fromEntries(Object.entries(query).map(([key, value]) => [key, value.trim()]));
  result.archive = result.archive || 'exclude';
  if (!['exclude', 'only', 'all'].includes(result.archive)) input('Invalid archive filter');
  if (result.status && !statuses.has(result.status)) input('Invalid Asset status');
  if (result.departmentId && result.departmentId !== 'unassigned') ownership.id(result.departmentId);
  return result;
}
router.use(authenticateToken, authorizeRoles('admin', 'technician'));
router.get('/options', async (req, res) => {
  try {
    if (Object.keys(req.query).length) input('Unsupported options filter');
    const facilityId = await ownership.selectedFacility(req);
    const departments = await Department.find({ facilityId }).select('_id name').sort({ name: 1, _id: 1 }).lean();
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ facilityId: String(facilityId), departments: departments.map(row => ({ id: String(row._id), name: text(row.name) })) });
  } catch (error) {
    if (error instanceof ownership.OwnershipError) return ownership.respond(res, error);
    return res.status(503).json({ error: 'Inventory filter choices unavailable.' });
  }
});
router.get('/', async (req, res) => {
  try {
    const selected = filters(req.query);
    const facilityId = await ownership.selectedFacility(req);
    const facility = await Facility.findById(facilityId).select('_id name').lean();
    if (!facility) return res.status(404).json({ error: 'Facility not found' });
    const departments = await Department.find({ facilityId }).select('_id name').sort({ name: 1, _id: 1 }).lean();
    const names = new Map(departments.map(row => [String(row._id), text(row.name)]));
    if (selected.departmentId && selected.departmentId !== 'unassigned' && !names.has(selected.departmentId)) {
      return res.status(404).json({ error: 'Department not found in selected Facility' });
    }
    const query = { facilityId, deletedAt: null };
    if (selected.archive !== 'all') query.isArchived = selected.archive === 'only' ? true : { $ne: true };
    if (selected.status) query.status = selected.status;
    if (selected.equipmentClass) query.equipmentClass = selected.equipmentClass;
    if (selected.departmentId) query.departmentId = selected.departmentId === 'unassigned' ? null : selected.departmentId;
    if (selected.q) {
      const literal = selected.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = ['ctrlNumber', 'manufacturer', 'model', 'serialNumber', 'description'].map(field => ({ [field]: { $regex: literal, $options: 'i' } }));
    }
    const assets = await Asset.find(query)
      .select('_id ctrlNumber manufacturer model description serialNumber status isArchived departmentId locationNote equipmentClass maintenanceSchedule')
      .sort({ ctrlNumber: 1, _id: 1 }).limit(MAX_ROWS + 1).maxTimeMS(10000).lean();
    if (assets.length > MAX_ROWS) return res.status(413).json({ error: `Report exceeds ${MAX_ROWS} assets. Narrow the filters; no partial report was generated.` });
    const rows = assets.map(asset => {
      const departmentName = names.get(String(asset.departmentId));
      return {
        id: String(asset._id), ctrlNumber: text(asset.ctrlNumber), manufacturer: text(asset.manufacturer), model: text(asset.model),
        description: text(asset.description), serialNumber: text(asset.serialNumber), equipmentClass: text(asset.equipmentClass),
        status: text(asset.status), isArchived: asset.isArchived === true, location: text(asset.locationNote),
        department: departmentName ?? '', departmentState: !asset.departmentId ? 'unassigned' : departmentName === undefined ? 'unavailable' : 'resolved',
        pmFrequency: text(asset.maintenanceSchedule?.frequency), lastPM: date(asset.maintenanceSchedule?.lastMaintenance), nextPM: date(asset.maintenanceSchedule?.nextMaintenance),
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ schemaVersion: 'asset-inventory-v1', generatedAt: new Date().toISOString(),
      facility: { id: String(facility._id), name: text(facility.name) }, filters: selected,
      departments: departments.map(row => ({ id: String(row._id), name: text(row.name) })), rows, rowCount: rows.length,
      dataQuality: { missingSerial: rows.filter(row => !row.serialNumber.trim()).length,
        unassignedDepartment: rows.filter(row => row.departmentState === 'unassigned').length,
        unavailableDepartment: rows.filter(row => row.departmentState === 'unavailable').length,
        missingNextPM: rows.filter(row => !row.nextPM).length },
      notes: ['Current inventory at generation time; not a historical as-of snapshot.',
        'Deleted assets are excluded. Archive and status filters are independent; retired assets remain unless filtered out.',
        'PM dates and frequency are recorded schedule fields, not verified PM completion or compliance. Missing dates do not establish overdue status.',
        'Contract coverage and service history are not included in this inventory report.'],
    });
  } catch (error) {
    if (error instanceof ownership.OwnershipError) return ownership.respond(res, error);
    return res.status(503).json({ error: 'Asset inventory report unavailable. Please try again.' });
  }
});
module.exports = router;
