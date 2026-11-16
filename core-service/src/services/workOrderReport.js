const costs = require('./workOrderCosts/calculate');
const OPEN = ['Requested', 'Open', 'In Progress'];
const iso = value => value != null && value !== '' && Number.isFinite(+new Date(value)) ? new Date(value).toISOString() : null;
const text = value => typeof value === 'string' ? value : '';
function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }
function parseFilters(query) {
  if (Object.keys(query).some(k => !['mode', 'startDate', 'endDate', 'priority', 'workOrderType', 'includeArchived'].includes(k)) || Object.values(query).some(v => typeof v !== 'string' || v.length > 120)) invalid('Invalid Work Order report filter');
  const filters = Object.fromEntries(Object.entries(query).map(([k, v]) => [k, v.trim()]));
  filters.mode ||= 'open'; filters.includeArchived ||= 'false';
  if (!['open', 'closed'].includes(filters.mode) || !['true', 'false'].includes(filters.includeArchived)) invalid('Invalid report mode or archive option');
  if (filters.priority && !['Low', 'Normal', 'High', 'Critical'].includes(filters.priority)) invalid('Invalid priority');
  if (filters.mode === 'open' && (filters.startDate || filters.endDate || filters.includeArchived === 'true')) invalid('Open backlog uses current status without a date range or archived records');
  if (filters.mode === 'closed') {
    for (const k of ['startDate', 'endDate']) if (!/^\d{4}-\d{2}-\d{2}$/.test(filters[k] || '') || iso(filters[k])?.slice(0, 10) !== filters[k]) invalid('Closed activity requires valid start and end dates');
    if (filters.startDate > filters.endDate) invalid('End date must be on or after start date');
  }
  return filters;
}
function queryFor(facilityId, filters) {
  return { facilityId, deletedAt: null, status: { $in: filters.mode === 'open' ? OPEN : filters.includeArchived === 'true' ? ['Completed', 'Archived'] : ['Completed'] },
    ...(filters.mode === 'closed' ? { completionDate: { $gte: new Date(`${filters.startDate}T00:00:00.000Z`), $lt: new Date(+new Date(`${filters.endDate}T00:00:00.000Z`) + 86400000) } } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}), ...(filters.workOrderType ? { workOrderType: filters.workOrderType } : {}) };
}
function buildReport({ facility, filters, workOrders, assets = [], generatedAt = new Date() }) {
  const equipment = new Map(assets.map(a => [String(a._id), a]));
  const assessed = workOrders.map(row => ({ row, cost: costs.read(row).scopes.directMaintenance }));
  const now = +generatedAt;
  const rows = assessed.map(({ row, cost }) => {
    const asset = equipment.get(String(row.assetId));
    const requested = iso(row.requestDate), due = iso(row.dueDate);
    return { id: String(row._id), number: row.workOrderNumber ?? '', status: text(row.status), priority: text(row.priority), type: text(row.workOrderType), description: text(row.description),
      asset: asset ? { id: String(asset._id), controlNumber: text(asset.ctrlNumber), manufacturer: text(asset.manufacturer), model: text(asset.model) } : null,
      requested, scheduled: iso(row.scheduledDate), due, completed: iso(row.completionDate),
      ageDays: filters.mode === 'open' && requested && +new Date(requested) <= now ? Math.floor((now - +new Date(requested)) / 86400000) : null,
      overdue: filters.mode === 'open' && due ? +new Date(due) < now : null, cost };
  });
  return { schemaVersion: 'work-order-report-v1', generatedAt: generatedAt.toISOString(), facility: { id: String(facility._id), name: text(facility.name) }, filters, rows,
    summary: { count: rows.length, overdue: rows.filter(r => r.overdue === true).length, missingDueDates: rows.filter(r => !r.due).length,
      missingRequestDates: rows.filter(r => !r.requested).length, unavailableAssets: rows.filter(r => !r.asset).length,
      archived: rows.filter(r => r.status === 'Archived').length, cost: costs.combine(assessed.map(item => item.cost)) },
    notes: ['Current recorded Work Order statuses, not a historical backlog snapshot. Deleted Work Orders are excluded.',
      'Open means Requested, Open or In Progress. Age is elapsed whole 24-hour days since request at generation time; future or missing request dates have unknown age. Overdue means due timestamp precedes generation time.',
      'Closed activity uses current Completed status and completion dates in UTC, inclusive of the end day. Optional Archived records must also have a completion date in the selected range; archived does not itself certify completion.',
      'Asset labels are current selected-hospital references. Deleted, missing or foreign assets are unavailable; their Work Orders remain counted.',
      'Costs use the canonical Core engine and current whole-Work-Order totals, not period expenses. Known subtotals are not complete totals; missing evidence stays unknown. No PM compliance or historical coverage is inferred.'] };
}
module.exports = { parseFilters, queryFor, buildReport };
