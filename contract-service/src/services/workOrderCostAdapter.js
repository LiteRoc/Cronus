// Transport adapter only: core-service owns pricing and scope calculation.
const unknown = () => ({
  knownSubtotal: 0,
  total: null,
  isComplete: false,
  missingComponents: [{
    reason: 'canonical_cost_unavailable'
  }],
  valuationBases: []
});
const valid = s => s && Number.isFinite(s.knownSubtotal) && s.knownSubtotal >= 0 && typeof s.isComplete === 'boolean' && Array.isArray(s.missingComponents) && (s.isComplete ? Number.isFinite(s.total) && s.total === s.knownSubtotal && s.missingComponents.length === 0 : s.total === null && s.missingComponents.length > 0);
export function scopeOf(w, name, component = false) {
  const c = w.costs;
  if (c?.calculationVersion !== 'wo-cost-v1' || w.economics?.schemaVersion !== 1 || c.inputRevision !== w.economics.revision || !['current', 'stale'].includes(c.cacheState) || c.cacheState === 'stale' && !c.readDerived) return unknown();
  const s = component ? c.components?.[name] : c.scopes?.[name];
  return valid(s) ? s : unknown();
}
export function aggregateScope(rows, name, component = false) {
  const scopes = rows.map(w => scopeOf(w, name, component));
  const knownSubtotal = scopes.reduce((s, v) => s + Math.round(v.knownSubtotal * 100), 0) / 100;
  const isComplete = scopes.every(s => s.isComplete),
    fullyPricedCount = scopes.filter(s => s.isComplete).length;
  return {
    knownSubtotal,
    total: isComplete ? knownSubtotal : null,
    isComplete,
    missingComponents: scopes.flatMap(s => s.missingComponents),
    workOrderCount: rows.length,
    fullyPricedCount,
    fullyPricedPercent: rows.length ? fullyPricedCount / rows.length * 100 : null,
    legacyCount: rows.filter(w => !w.economics || w.economics.origin === 'legacy_mixed').length,
    calculationVersion: 'wo-cost-v1'
  };
}
export function canonicalCosts(rows) {
  const scopes = Object.fromEntries(['internal', 'vendorDirect', 'directMaintenance'].map(n => [n, aggregateScope(rows, n)]));
  const components = Object.fromEntries(['internalLabor', 'internalTravel', 'internalParts'].map(n => [n, aggregateScope(rows, n, true)]));
  const assetCosts = [...new Set(rows.map(w => String(w.assetId)))].map(assetId => {
    const own = rows.filter(w => String(w.assetId) === assetId),
      direct = aggregateScope(own, 'directMaintenance');
    return {
      assetId,
      woCount: own.length,
      partsCost: aggregateScope(own, 'internalParts', true).total,
      laborCost: aggregateScope(own, 'internalLabor', true).total,
      travelCost: aggregateScope(own, 'internalTravel', true).total,
      vendorCost: aggregateScope(own, 'vendorDirect').total,
      totalCost: direct.total,
      economics: direct,
      laborHours: own.reduce((s, w) => s + (w.timeLogs || []).reduce((n, l) => n + Number(l.timeSpent || 0) / 60, 0), 0),
      travelHours: own.reduce((s, w) => s + (w.travelLogs || []).reduce((n, l) => n + Number(l.travelTime || 0) / 60, 0), 0)
    };
  });
  return {
    scopes,
    components,
    assetCosts
  };
}
