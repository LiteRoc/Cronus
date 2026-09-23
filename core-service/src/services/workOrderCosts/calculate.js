const {
  createHash
} = require('crypto');
const VERSION = 'wo-cost-v1';
const finite = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12;
function rational(v) {
  if (!finite(v)) throw new Error('Invalid nonnegative monetary input');
  const [mantissa, exponent = '0'] = String(v).toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const scale = fraction.length - Number(exponent);
  return scale >= 0 ? [BigInt(whole + fraction), 10n ** BigInt(scale)] : [BigInt(whole + fraction) * 10n ** BigInt(-scale), 1n];
}
function amount(quantity, rate, divisor = 1) {
  const [q, qd] = rational(quantity),
    [r, rd] = rational(rate),
    [d, dd] = rational(divisor);
  if (d === 0n) throw new Error('Invalid divisor');
  const n = q * r * dd * 100n,
    den = qd * rd * d;
  const cents = (2n * n + den) / (2n * den);
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Monetary overflow');
  return Number(cents) / 100;
}
function sum(values) {
  return values.reduce((s, v) => s + Math.round(v * 100), 0) / 100;
}
function stable(v) {
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v.toHexString === 'function') return v.toHexString();
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, stable(v[k])]));
  return v;
}
function inputs(w) {
  const pick = (x, keys) => Object.fromEntries(keys.filter(k => x[k] !== undefined).map(k => [k, x[k]]));
  return {
    timeLogs: (w.timeLogs || []).map(x => pick(x, ['_id', 'timeSpent', 'workDate', 'laborRate', 'laborCost', 'pricing'])),
    partsUsed: (w.partsUsed || []).map(x => pick({
      ...x,
      partId: x.partId?._id || x.partId
    }, ['_id', 'partId', 'quantity', 'unitCost', 'extendedCost', 'pricing'])),
    travelLogs: (w.travelLogs || []).map(x => pick(x, ['_id', 'travelTime', 'workDate'])),
    vendorService: w.vendorService || null,
    origin: w.economics?.origin || 'legacy',
    unresolvedLegacyComponents: w.economics?.unresolvedLegacyComponents || []
  };
}
const fingerprint = w => createHash('sha256').update(JSON.stringify(stable(inputs(w)))).digest('hex');
function trusted(p, value) {
  return finite(value) && p?.version === 1 && ['blended_internal', 'catalog_default', 'documented'].includes(p.basis) && Boolean(p.sourceKind && p.sourceId && p.capturedBy && p.capturedAt) && Number.isFinite(new Date(p.capturedAt).getTime()) && (value !== 0 || p.zeroEvidence === true);
}
function scope(known = [], missing = [], bases = []) {
  const knownSubtotal = sum(known);
  return {
    knownSubtotal,
    total: missing.length ? null : knownSubtotal,
    isComplete: missing.length === 0,
    missingComponents: missing,
    valuationBases: [...new Set(bases)].sort()
  };
}
function combine(scopes) {
  return scope(scopes.map(s => s.knownSubtotal), scopes.flatMap(s => s.missingComponents), scopes.flatMap(s => s.valuationBases));
}
const missing = (component, reason, entryId) => ({
  component,
  reason,
  ...(entryId ? {
    entryId: String(entryId)
  } : {})
});
function lines(entries, component, rateKey, costKey, quantityKey, divisor) {
  const known = [],
    absent = [],
    bases = [];
  for (const e of entries || []) {
    if (!trusted(e.pricing, e[rateKey]) || !finite(e[quantityKey])) {
      absent.push(missing(component, e.pricing?.unknownReason || 'unverified_snapshot', e._id));
      continue;
    }
    let expected;
    try {
      expected = amount(e[quantityKey], e[rateKey], divisor);
    } catch (_) {
      absent.push(missing(component, 'invalid_amount', e._id));
      continue;
    }
    if (e[costKey] !== expected) {
      absent.push(missing(component, 'snapshot_amount_conflict', e._id));
      continue;
    }
    known.push(expected);
    bases.push(e.pricing.basis);
  }
  return scope(known, absent, bases);
}
function vendor(v, native) {
  if (!v) return {
    ...scope([], native ? [] : [missing('vendorDirect', 'legacy_scope_unknown')]),
    reconciliation: 'unavailable',
    selectedBasis: 'incomplete'
  };
  const attributable = v.attribution?.status === 'attributable' && v.attribution?.evidenceRef && v.attribution?.recordedBy;
  if (v.attribution?.status === 'covered_elsewhere' && v.attribution?.knownZero === true && v.attribution?.evidenceRef && v.attribution?.recordedBy) return {
    ...scope([0], [], ['documented']),
    reconciliation: 'unavailable',
    selectedBasis: 'documented_coverage'
  };
  if (!attributable) return {
    ...scope([], [missing('vendorDirect', 'attribution_unknown')]),
    reconciliation: 'unavailable',
    selectedBasis: 'incomplete'
  };
  const keys = ['laborCost', 'travelCost', 'partsCost', 'shippingCost'];
  const known = keys.filter(k => trusted(v.pricing?.components?.[k], v[k]));
  const complete = v.breakdownComplete === true && known.length === keys.length;
  const subtotal = sum(known.map(k => amount(1, v[k])));
  const totalKnown = trusted(v.pricing?.total, v.totalCost);
  const difference = totalKnown && complete ? amount(1, v.totalCost) - subtotal : null;
  if (totalKnown && complete && Math.abs(difference) >= 0.005) return {
    ...scope([], [missing('vendorDirect', 'invoice_component_discrepancy')]),
    reconciliation: 'discrepancy',
    difference,
    selectedBasis: 'incomplete'
  };
  if (totalKnown) return {
    ...scope([amount(1, v.totalCost)], [], [v.pricing.total.basis]),
    reconciliation: complete ? 'matched' : 'breakdown_incomplete',
    difference,
    selectedBasis: 'invoice_total'
  };
  return {
    ...scope(known.map(k => amount(1, v[k])), complete ? [] : [missing('vendorDirect', 'incomplete_components')], known.map(k => v.pricing.components[k].basis)),
    reconciliation: 'unavailable',
    selectedBasis: complete ? 'component_sum' : 'incomplete'
  };
}
function calculate(w, now = new Date()) {
  const native = w.economics?.schemaVersion === 1 && ['native', 'import'].includes(w.economics?.origin);
  const labor = lines(w.timeLogs, 'internalLabor', 'laborRate', 'laborCost', 'timeSpent', 60);
  const parts = lines(w.partsUsed, 'internalParts', 'unitCost', 'extendedCost', 'quantity', 1);
  const travel = scope([], (w.travelLogs || []).map(e => missing('internalTravel', 'travel_policy_unapproved', e._id)));
  if (!native) {
    for (const [name, s] of [['internalLabor', labor], ['internalParts', parts], ['internalTravel', travel]]) {
      s.missingComponents.push(missing(name, 'legacy_scope_unknown'));
      s.isComplete = false;
      s.total = null;
    }
  }
  const internal = combine([labor, travel, parts]);
  const vendorDirect = vendor(w.vendorService, native);
  const narrow = combine([labor, parts]);
  return {
    currency: 'USD',
    calculationVersion: VERSION,
    inputRevision: w.economics?.revision ?? null,
    inputFingerprint: fingerprint(w),
    calculatedAt: now,
    labor: labor.total,
    parts: parts.total,
    total: narrow.total,
    components: {
      internalLabor: labor,
      internalTravel: travel,
      internalParts: parts
    },
    scopes: {
      internal,
      vendorDirect,
      directMaintenance: combine([internal, vendorDirect])
    }
  };
}
function read(w) {
  const malformed = ['timeLogs','partsUsed','travelLogs'].some(key => w[key] != null && (!Array.isArray(w[key]) || w[key].some(entry => !entry || typeof entry !== 'object')));
  const unsupported = w.economics?.schemaVersion != null && (w.economics.schemaVersion !== 1 || !Number.isSafeInteger(w.economics.revision) || w.economics.revision < 1);
  if (malformed || unsupported || w.costs?.calculationVersion && w.costs.calculationVersion !== VERSION) {
    const unknown = scope([], [missing('all', malformed ? 'invalid_recorded_economics' : 'unsupported_version')]);
    return {
      calculationVersion: w.costs?.calculationVersion ?? null,
      cacheState: 'unsupported',
      labor: null,
      parts: null,
      total: null,
      components: {
        internalLabor: unknown,
        internalTravel: unknown,
        internalParts: unknown
      },
      scopes: {
        internal: unknown,
        vendorDirect: unknown,
        directMaintenance: unknown
      }
    };
  }
  const expected = calculate(w, w.costs?.calculatedAt || null);
  const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
  const valid = w.economics?.schemaVersion === 1 && w.costs?.calculationVersion === VERSION && w.costs.inputRevision === w.economics.revision && w.costs.inputFingerprint === expected.inputFingerprint && equal(w.costs.scopes, expected.scopes) && equal(w.costs.components, expected.components) && w.costs.labor === expected.labor && w.costs.parts === expected.parts && w.costs.total === expected.total;
  return {
    ...expected,
    cacheState: valid ? 'current' : w.economics?.schemaVersion === 1 ? 'stale' : 'legacy',
    readDerived: !valid
  };
}
function serialize(w) {
  if (!w) return w;
  const raw = w.toObject ? w.toObject() : w;
  return {
    ...raw,
    costs: read(raw)
  };
}
function summarize(workOrders, name = 'directMaintenance') {
  const results = workOrders.map(w => read(w));
  const selected = results.map(r => r.scopes[name]);
  const fullyPricedCount = selected.filter(s => s.isComplete).length;
  return {
    ...combine(selected),
    calculationVersion: VERSION,
    workOrderCount: workOrders.length,
    fullyPricedCount,
    fullyPricedPercent: workOrders.length ? fullyPricedCount / workOrders.length * 100 : null,
    legacyCount: workOrders.filter((w, i) => results[i].cacheState === 'legacy' || w.economics?.origin === 'legacy_mixed').length,
    staleCount: results.filter(r => r.cacheState === 'stale').length,
    unsupportedCount: results.filter(r => r.cacheState === 'unsupported').length
  };
}
module.exports = {
  VERSION,
  finite,
  amount,
  sum,
  stable,
  fingerprint,
  trusted,
  scope,
  combine,
  calculate,
  read,
  serialize,
  summarize
};
