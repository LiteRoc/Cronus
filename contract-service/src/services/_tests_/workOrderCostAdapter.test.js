import { canonicalCosts, scopeOf } from '../workOrderCostAdapter.js';
const scope = (value, complete = true) => ({
  knownSubtotal: value,
  total: complete ? value : null,
  isComplete: complete,
  missingComponents: complete ? [] : [{
    reason: 'unknown'
  }],
  valuationBases: []
});
const row = () => ({
  assetId: 'synthetic',
  economics: {
    schemaVersion: 1,
    revision: 2,
    origin: 'native'
  },
  costs: {
    calculationVersion: 'wo-cost-v1',
    inputRevision: 2,
    cacheState: 'current',
    components: {
      internalLabor: scope(75),
      internalParts: scope(0, false),
      internalTravel: scope(0)
    },
    scopes: {
      internal: scope(75, false),
      vendorDirect: scope(100),
      directMaintenance: scope(175, false)
    }
  }
});
test('canonical scopes preserve known subtotal and null total without fallback repricing', () => {
  const w = row();
  w.timeLogs = [{
    timeSpent: 600
  }];
  w.vendorService = {
    laborHours: 100,
    totalCost: 5000
  };
  w.partsUsed = [{
    extendedPrice: 900
  }];
  const result = canonicalCosts([w]);
  expect(result.scopes.directMaintenance).toMatchObject({
    knownSubtotal: 175,
    total: null,
    fullyPricedCount: 0
  });
  expect(result.assetCosts[0]).toMatchObject({
    laborCost: 75,
    partsCost: null,
    vendorCost: 100,
    totalCost: null,
    laborHours: 10
  });
});
test('unsupported, mismatched and malformed transport caches fail closed', () => {
  for (const change of [{
    calculationVersion: 'future'
  }, {
    inputRevision: 1
  }, {
    cacheState: 'stale',
    readDerived: false
  }]) {
    const w = row();
    Object.assign(w.costs, change);
    expect(scopeOf(w, 'vendorDirect').total).toBeNull();
  }
  const w = row();
  w.costs.scopes.vendorDirect = scope(100);
  w.costs.scopes.vendorDirect.total = 0;
  expect(scopeOf(w, 'vendorDirect').total).toBeNull();
});
test('safe read-derived transport allowed; known zero preserved', () => {
  const w = row();
  w.costs.cacheState = 'stale';
  w.costs.readDerived = true;
  expect(scopeOf(w, 'vendorDirect').total).toBe(100);
  w.costs.scopes.vendorDirect = scope(0);
  expect(scopeOf(w, 'vendorDirect').total).toBe(0);
});
