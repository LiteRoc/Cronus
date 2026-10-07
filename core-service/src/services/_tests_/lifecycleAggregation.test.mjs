import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  aggregateLifecycle,
  maintenanceWindow
} = require('../lifecycleAggregation');
const {
  buildAssetLifecycleAssessment
} = require('../assetLifecycleAssessment');
const asOf = '2026-10-07T00:00:00.000Z';
function row(id = 'A') {
  const assessment = buildAssetLifecycleAssessment({
    asset: {
      _id: id
    },
    asOf: new Date(asOf)
  });
  assessment.maintenance.window = maintenanceWindow(asOf);
  assessment.maintenance.last365Days = {};
  assessment.maintenance.last365Days.directMaintenance = {
    knownSubtotal: 0,
    total: 0,
    isComplete: true,
    missingComponents: [],
    valuationBases: [],
    workOrderCount: 0,
    fullyPricedCount: 0
  };
  return {
    assetId: id,
    assessment
  };
}
const aggregate = rows => aggregateLifecycle(rows, {
  asOf
});
const value = (r, amount, currency = 'USD', status = 'estimated') => {
  r.assessment.capital.replacementValue = {
    amount,
    currency,
    status
  };
  return r;
};
test('all known and explicit zero have complete totals', () => expect(aggregate([value(row('A'), 100000), value(row('B'), 0)]).capital.replacementValue).toMatchObject({
  total: 100000,
  isComplete: true,
  valuedAssetCount: 2
}));
test('partial capital preserves subtotal independently from other measures', () => {
  const r = aggregate([value(row('A'), 100000), row('B')]);
  expect(r.capital.replacementValue).toMatchObject({
    total: null,
    knownSubtotal: 100000,
    missingAssetCount: 1
  });
  expect(r.capital.estimatedDepreciatedValue).toMatchObject({
    total: null,
    knownSubtotal: 0,
    valuedAssetCount: 0,
    missingAssetCount: 2
  });
});
for (const amount of [-1, NaN, Infinity, '100']) test(`invalid capital ${amount}`, () => expect(aggregate([value(row(), amount)]).capital.replacementValue.valuedAssetCount).toBe(0));
test('invalid status remains unresolved', () => expect(aggregate([value(row(), 100, 'USD', 'invalid')]).capital.replacementValue.total).toBeNull());
test('unavailable assessment remains denominator', () => {
  const r = aggregate([value(row('A'), 100000), {
    assetId: 'B',
    assessment: null,
    reason: 'asset_unavailable'
  }]);
  expect(r.population).toMatchObject({
    populationAssetCount: 2,
    assessedAssetCount: 1,
    unavailableAssessmentCount: 1
  });
  expect(r.capital.replacementValue.total).toBeNull();
  expect(r.replacementReview.unavailableAssessmentCount).toBe(1);
});
test('mixed currency groups do not combine', () => {
  const m = aggregate([value(row('A'), 10), value(row('B'), 20, 'EUR')]).capital.replacementValue;
  expect(m.total).toBeNull();
  expect(m.knownSubtotal).toBeNull();
  expect(m.currencyGroups).toHaveLength(2);
});
test('unknown currencies remain individual amounts', () => {
  const m = aggregate([value(row('A'), 10, null), value(row('B'), 20, null)]).capital.replacementValue;
  expect(m.total).toBeNull();
  expect(m.knownSubtotal).toBeNull();
  expect(m.unidentifiedCurrencyValues).toHaveLength(2);
});
test('single unknown currency amount stays visible but incomplete', () => expect(aggregate([value(row(), 100000, null)]).capital.replacementValue).toMatchObject({
  knownSubtotal: 100000,
  total: null,
  currencyUnknownAssetCount: 1
}));
test('all recommendation states and unavailable reconcile', () => {
  const rows = ['recommended', 'not_recommended', 'insufficient_data'].map((state, i) => {
    const r = row(String(i));
    r.assessment.replacementAssessment.state = state;
    return r;
  });
  rows.push({
    assetId: 'missing',
    assessment: null
  });
  expect(aggregate(rows).replacementReview).toMatchObject({
    populationAssetCount: 4,
    recommendedCount: 1,
    notRecommendedCount: 1,
    insufficientDataCount: 1,
    unavailableAssessmentCount: 1,
    evaluatedCount: 2,
    recommendedPercentOfPopulation: 25,
    recommendedPercentOfEvaluated: 50
  });
});
test('zero population percentages and means are null', () => {
  const r = aggregate([]);
  expect(r.replacementReview.recommendedPercentOfPopulation).toBeNull();
  expect(r.replacementReview.recommendedPercentOfEvaluated).toBeNull();
  expect(r.maintenance.directMaintenance.statistics.fleetMean).toBeNull();
});
test('fractional age intervals have no gaps; unknown states excluded', () => {
  const rows = [0, 2.5, 3, 5.5, 6, 8.5, 9].map((years, i) => {
    const r = row(String(i));
    r.assessment.serviceAge = {
      status: i % 2 ? 'estimated' : 'resolved',
      years
    };
    return r;
  });
  for (const status of ['unknown', 'invalid', 'not_started']) {
    const r = row(status);
    r.assessment.serviceAge = {
      status,
      years: null
    };
    rows.push(r);
  }
  const a = aggregate(rows).age;
  expect(a.buckets.map(b => b.count)).toEqual([2, 2, 2, 1]);
  expect(a.stateCounts).toMatchObject({
    unknown: 1,
    invalid: 1,
    not_started: 1,
    estimated: 3
  });
});
test('incomplete direct scope preserves subtotal and complete-record sample', () => {
  const a = row('A'),
    b = row('B');
  a.assessment.maintenance.last365Days.directMaintenance.knownSubtotal = 10;
  a.assessment.maintenance.last365Days.directMaintenance.total = 10;
  b.assessment.maintenance.last365Days.directMaintenance = {
    knownSubtotal: 60,
    total: null,
    isComplete: false,
    missingComponents: [{
      component: 'internalTravel',
      reason: 'unpriced'
    }],
    valuationBases: ['documented'],
    workOrderCount: 2,
    fullyPricedCount: 0
  };
  const m = aggregate([a, b]).maintenance.directMaintenance;
  expect(m).toMatchObject({
    knownSubtotal: 70,
    total: null,
    completeAssetCount: 1,
    statistics: {
      fleetMean: null,
      completeRecordSampleMean: 10,
      sampleAssetCount: 1,
      populationAssetCount: 2
    }
  });
  expect(m.missingComponents[0].assetId).toBe('B');
});
test('complete scope fleet mean and counts', () => expect(aggregate([row('A'), row('B')]).maintenance.directMaintenance).toMatchObject({
  total: 0,
  isComplete: true,
  statistics: {
    fleetMean: 0,
    sampleAssetCount: 2
  },
  workOrders: {
    knownCount: 0,
    isComplete: true
  }
}));
test('window semantics remain inclusive completionDate', () => expect(aggregate([]).maintenance.window).toMatchObject({
  durationDays: 365,
  startInclusive: true,
  endInclusive: true,
  dateField: 'completionDate',
  statuses: ['Completed'],
  end: asOf
}));
test('window mismatch incomplete', () => {
  const a = row();
  a.assessment.maintenance.window.endInclusive = false;
  expect(aggregate([a]).maintenance.directMaintenance.total).toBeNull();
});
test('mismatched canonical fact unavailable', () => {
  const r = row();
  r.assessment.assetId = 'other';
  expect(aggregate([r]).population.unavailableAssessmentCount).toBe(1);
});
test('duplicate population rejected', () => expect(() => aggregate([row(), row()])).toThrow('unique'));
test('capital completeness is independent for each canonical measure',()=>{const a=value(row('A'),0),b=value(row('B'),0);a.assessment.capital.estimatedDepreciatedValue={amount:50,currency:'USD',status:'estimated'};const c=aggregate([a,b]).capital;expect(c.replacementValue.total).toBe(0);expect(c.estimatedDepreciatedValue).toMatchObject({knownSubtotal:50,total:null,missingAssetCount:1});expect(c.accountingBookValue).toMatchObject({knownSubtotal:0,total:null,missingAssetCount:2});});
