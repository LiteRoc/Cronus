import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  cache = require('../lifecycleCache');
const {
  buildAssetLifecycleAssessment
} = require('../assetLifecycleAssessment');
const now = new Date('2026-10-07T00:00:00Z'),
  asset = {
    _id: 'A'
  },
  evidence = {
    sourceFingerprint: 'synthetic',
    dependencies: {}
  };
function stored() {
  const assessment = buildAssetLifecycleAssessment({
    asset,
    asOf: now,
    computedAt: now
  });
  return {
    ...asset,
    lifecycleCache: cache.envelope({
      assessment,
      metrics: {
        projectedAnnualMaintenance: 0
      }
    }, evidence, now)
  };
}
test('no cache missing', () => expect(cache.freshness(asset, evidence, now).state).toBe('missing'));
test('legacy cache stale regardless of computedAt', () => expect(cache.freshness({
  ...asset,
  metrics: {
    computedAt: now,
    replacementRecommended: false
  }
}, evidence, now).state).toBe('stale'));
test('matching supported future-valid cache fresh', () => expect(cache.freshness(stored(), evidence, now).state).toBe('fresh'));
for (const key of ['schemaVersion', 'calculationVersion', 'policyVersion', 'economicCalculationVersion']) test(`unsupported ${key}`, () => {
  const a = stored();
  a.lifecycleCache[key] = 'old';
  expect(cache.freshness(a, evidence, now).state).toBe('unsupported');
});
test('source mismatch stale', () => expect(cache.freshness(stored(), {
  sourceFingerprint: 'changed'
}, now).state).toBe('stale'));
test('expiry without source edits stale', () => expect(cache.freshness(stored(), evidence, new Date(now.getTime() + 3600000)).state).toBe('stale'));
test('invalidated supported cache stale', () => {
  const a = stored();
  a.lifecycleCache.invalidatedAt = now;
  expect(cache.freshness(a, evidence, now).state).toBe('stale');
});
test('future evaluation not trusted', () => expect(cache.freshness(stored(), evidence, new Date(now.getTime() - 1)).state).toBe('stale'));
test('future service begins before hourly expiry', () => {
  const a = stored().lifecycleCache.assessment;
  a.serviceAge = {
    status: 'not_started',
    startDate: '2026-10-07T00:00:10Z',
    years: null
  };
  expect(cache.expiry(a)).toBe('2026-10-07T00:00:10.000Z');
});
test('adopted life threshold caps expiry', () => {
  const a = stored().lifecycleCache.assessment;
  a.serviceAge = {
    status: 'resolved',
    years: 5 - 1 / 365.25 / 86400
  };
  a.expectedLife = {
    years: 5,
    isAdopted: true
  };
  expect(Date.parse(cache.expiry(a)) - now.getTime()).toBeLessThanOrEqual(1001);
});
test('rolling-window event caps hourly expiry', () => {
  const a = stored().lifecycleCache.assessment;
  expect(cache.expiry(a, {
    dependencies: {
      nextMaintenanceTransition: '2026-10-07T00:00:30Z'
    }
  })).toBe('2026-10-07T00:00:30.000Z');
});
test('fingerprint stable under object key order', () => expect(cache.digest({
  a: 1,
  b: 2
})).toBe(cache.digest({
  b: 2,
  a: 1
})));
test('canonical assessment identity/version validated', () => {
  const a = stored();
  a.lifecycleCache.assessment.assetId = 'other';
  expect(cache.freshness(a, evidence, now).state).toBe('unsupported');
});
