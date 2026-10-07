import Asset from '../models/Asset.js';
import { getMaintenanceTotalsBatch } from './lifecycleMaintenance.js';
function median(a) {
  const s = [...a].sort((x, y) => x - y),
    n = s.length;
  return n ? n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 : null;
}
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
export async function getTemplateMaintenanceBenchmarks(templateId, opts = {}) {
  const filter = {
    templateId,
    deletedAt: null
  };
  if (!opts.includeRetired) filter.status = {
    $ne: 'Retired'
  };
  const assets = await Asset.find(filter).select('_id facilityId').lean();
  const totals = await getMaintenanceTotalsBatch(assets.map(a => a._id), {
    now: opts.now,
    completedStatuses: opts.completedStatuses
  });
  function summary(group) {
    const rows = group.map(a => totals.get(String(a._id)));
    const scopes = Object.fromEntries(['internal', 'vendorDirect', 'directMaintenance'].map(name => {
      const annual = rows.map(r => r.last12Months.scopes[name]),
        life = rows.map(r => r.lifetime.scopes[name]);
      const complete = annual.filter(s => s.isComplete).map(s => s.total);
      return [name, {
        avgAnnualMaintenance: avg(complete),
        medianAnnualMaintenance: median(complete),
        avgLifetimeMaintenance: avg(life.filter(s => s.isComplete).map(s => s.total)),
        completeAssetCount: complete.length,
        sampleAssets: rows.length,
        knownSubtotal: annual.reduce((s, r) => s + r.knownSubtotal, 0),
        isComplete: annual.every(s => s.isComplete),
        fullyPricedWorkOrderCount: annual.reduce((s, r) => s + r.fullyPricedCount, 0),
        workOrderCount: annual.reduce((s, r) => s + r.workOrderCount, 0)
      }];
    }));
    // Existing narrow benchmark aliases are kept distinct from the named scopes.
    const annual = rows.map(r => r.last12Months.total).filter(v => v !== null),
      life = rows.map(r => r.lifetime.total).filter(v => v !== null);
    return {
      sampleAssets: rows.length,
      avgAnnualMaintenance: avg(annual),
      medianAnnualMaintenance: median(annual),
      sampleWOsAnnual: rows.reduce((s, r) => s + r.last12Months.count, 0),
      avgLifetimeMaintenance: avg(life),
      sampleWOsLifetime: rows.reduce((s, r) => s + r.lifetime.count, 0),
      completeAssetCount: annual.length,
      scope: 'internal_labor_parts',
      calculationVersion: 'wo-cost-v1',
      scopes
    };
  }
  return {
    tenant: summary(opts.facilityId ? assets.filter(a => String(a.facilityId) === String(opts.facilityId)) : assets),
    global: summary(assets)
  };
}
