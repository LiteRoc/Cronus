import WorkOrder from '../models/WorkOrder.js';
import costs from './workOrderCosts/calculate.js';
function period(rows) {
  const scopes = Object.fromEntries(['internal', 'vendorDirect', 'directMaintenance'].map(name => [name, costs.summarize(rows, name)]));
  const values = rows.map(w => costs.read(w));
  const labor = costs.combine(values.map(v => v.components.internalLabor));
  const parts = costs.combine(values.map(v => v.components.internalParts));
  // Deprecated aliases retain the narrow internal labor/parts scope.
  return {
    labor: labor.total,
    parts: parts.total,
    total: costs.combine([labor, parts]).total,
    count: rows.length,
    scopes
  };
}
export async function getMaintenanceTotalsBatch(assetIds, opts = {}) {
  const now = opts.now || new Date(),
    start = new Date(now);
  start.setDate(start.getDate() - 365);
  const filter = {
    assetId: {
      $in: assetIds
    },
    deletedAt: null,
    status: {
      $in: opts.completedStatuses || ['Completed']
    }
  };
  if (opts.facilityId) filter.facilityId = opts.facilityId;
  const rows = await WorkOrder.find(filter).select('assetId timeLogs travelLogs partsUsed vendorService economics costs completionDate').lean();
  return new Map(assetIds.map(id => {
    const all = rows.filter(w => String(w.assetId) === String(id));
    return [String(id), {
      lifetime: period(all),
      last12Months: period(all.filter(w => w.completionDate && new Date(w.completionDate) >= start && new Date(w.completionDate) <= now))
    }];
  }));
}
export async function getMaintenanceTotals(assetId, opts = {}) {
  return (await getMaintenanceTotalsBatch([assetId], opts)).get(String(assetId));
}
export default {
  getMaintenanceTotals,
  getMaintenanceTotalsBatch
};
