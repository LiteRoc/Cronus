const costs = require('./workOrderCosts/calculate');
const text = value => typeof value === 'string' ? value : '';
const date = value => value != null && value !== '' && Number.isFinite(+new Date(value)) ? new Date(value).toISOString() : null;
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function bad(message) { throw Object.assign(new Error(message), { status: 400 }); }
function parseFilters(query) {
  if (Object.keys(query).some(key => !['assetId', 'controlNumber', 'startDate', 'endDate'].includes(key)) ||
      Object.values(query).some(value => typeof value !== 'string' || value.length > 120)) bad('Invalid history report filter');
  const result = Object.fromEntries(Object.entries(query).map(([key, value]) => [key, value.trim()]));
  if (Boolean(result.assetId) === Boolean(result.controlNumber)) bad('Supply either an Asset ID or an exact control number');
  if (result.assetId && !/^[a-f\d]{24}$/i.test(result.assetId)) bad('Invalid Asset ID');
  if (result.assetId) result.assetId = result.assetId.toLowerCase();
  if (Boolean(result.startDate) !== Boolean(result.endDate)) bad('Supply both start and end dates, or leave both blank');
  if (result.startDate) {
    for (const key of ['startDate', 'endDate']) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(result[key]) || date(result[key])?.slice(0, 10) !== result[key]) bad('Invalid calendar date');
    }
    if (result.endDate < result.startDate) bad('End date must be on or after start date');
  }
  return result;
}
function hours(logs, field, round = true) {
  const entries = Array.isArray(logs) ? logs : [];
  const recorded = entries.reduce((sum, entry) => sum + (finite(entry?.[field]) ? entry[field] / 60 : 0), 0);
  return { recorded: round ? Math.round(recorded * 100) / 100 : recorded,
    invalidEntries: logs != null && !Array.isArray(logs) ? 1 : entries.filter(entry => !finite(entry?.[field])).length };
}
function buildReport({ asset, facility, department, workOrders, parts = [], filters, generatedAt = new Date() }) {
  const labels = new Map(parts.map(part => [String(part._id), part]));
  const evaluated = workOrders.map(row => ({ row, economic: costs.read(row) }));
  const sumScope = (section, name) => costs.combine(evaluated.map(item => item.economic[section][name]));
  const rows = evaluated.map(({ row, economic }) => ({
    id: String(row._id), number: row.workOrderNumber ?? '', requested: date(row.requestDate), completed: date(row.completionDate),
    type: text(row.workOrderType), status: text(row.status), description: text(row.description),
    labor: hours(row.timeLogs, 'timeSpent'), travel: hours(row.travelLogs, 'travelTime'),
    serviceNotes: (Array.isArray(row.timeLogs) ? row.timeLogs : []).filter(Boolean).map(log => ({ workDate: text(log.workDate), description: text(log.description) })),
    parts: (Array.isArray(row.partsUsed) ? row.partsUsed : []).filter(Boolean).map(part => {
      const label = labels.get(String(part.partId));
      return { id: part.partId ? String(part.partId) : '', number: text(label?.partNumber), description: text(label?.description),
        referenceState: label ? 'resolved_current_catalog' : 'unavailable', quantity: finite(part.quantity) ? part.quantity : null, note: text(part.note) };
    }),
    vendor: row.vendorService ? { name: text(row.vendorService.vendorName), workOrderNumber: text(row.vendorService.vendorWorkOrderNumber),
      laborHours: finite(row.vendorService.laborHours) ? row.vendorService.laborHours : null,
      travelHours: finite(row.vendorService.travelHours) ? row.vendorService.travelHours : null } : null,
    scopes: economic.scopes, components: economic.components, costState: economic.cacheState,
  }));
  return {
    schemaVersion: 'asset-history-v1', generatedAt: generatedAt.toISOString(), filters,
    facility: { id: String(facility._id), name: text(facility.name) },
    asset: { id: String(asset._id), ctrlNumber: text(asset.ctrlNumber), manufacturer: text(asset.manufacturer), model: text(asset.model),
      description: text(asset.description), serialNumber: text(asset.serialNumber), equipmentClass: text(asset.equipmentClass),
      status: text(asset.status), isArchived: asset.isArchived === true, location: text(asset.locationNote), department: text(department?.name),
      departmentState: !asset.departmentId ? 'unassigned' : department ? 'resolved' : 'unavailable',
      acquisitionDate: date(asset.acquisitionDate), installationDate: date(asset.installationDate), serviceStartDate: date(asset.serviceStartDate), retirementDate: date(asset.retirementDate),
      pmFrequency: text(asset.maintenanceSchedule?.frequency), lastPM: date(asset.maintenanceSchedule?.lastMaintenance), nextPM: date(asset.maintenanceSchedule?.nextMaintenance) },
    summary: { workOrderCount: rows.length, archivedCount: rows.filter(row => row.status === 'Archived').length,
      missingRequestDates: rows.filter(row => !row.requested).length,
      laborHours: Math.round(workOrders.reduce((sum, row) => sum + hours(row.timeLogs, 'timeSpent', false).recorded, 0) * 100) / 100,
      travelHours: Math.round(workOrders.reduce((sum, row) => sum + hours(row.travelLogs, 'travelTime', false).recorded, 0) * 100) / 100,
      invalidTimeEntries: rows.reduce((sum, row) => sum + row.labor.invalidEntries + row.travel.invalidEntries, 0),
      fullyPricedCount: rows.filter(row => row.scopes.directMaintenance.isComplete).length,
      scopes: Object.fromEntries(['internal', 'vendorDirect', 'directMaintenance'].map(name => [name, sumScope('scopes', name)])),
      components: Object.fromEntries(['internalLabor', 'internalTravel', 'internalParts'].map(name => [name, sumScope('components', name)])) },
    rows, notes: ['Current recorded service history, newest request date first; this is not an immutable historical snapshot or a certification that all service was recorded.',
      'Work Orders are selected by explicit assetId and exact Facility. Archived Work Orders are included; deleted records are excluded. Missing request dates are shown last in unfiltered history and excluded by date filters.',
      'Optional date filters use request date in UTC, inclusive of the end day. Costs and hours remain current whole-Work-Order totals, not expenses incurred within the selected dates.',
      'Internal labor/travel hours are recorded separately from vendor-reported hours; they are not added together. Invalid time entries are disclosed rather than treated as verified time.',
      'Cost scopes use the existing Core canonical engine. Unknown complete totals remain blank; known subtotals are not complete totals. No rates or legacy cost evidence are invented.',
      'Part names/numbers are current shared catalog labels, not historical snapshots. Missing references remain explicit. Service notes are recorded labor descriptions, not invented findings or resolutions.',
      'PM fields are the current recorded schedule, not a verified completion/compliance measure. Contract coverage, lifecycle recommendations, overhead and recurring vendor agreement payouts are outside this report.'] };
}
module.exports = { parseFilters, buildReport };
