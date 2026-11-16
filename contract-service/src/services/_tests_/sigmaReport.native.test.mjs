import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSigmaReport, reportPeriod } from '../sigmaReportService.js';

const contract = { _id: '000000000000000000000001', facilityId: '000000000000000000000002', name: 'Synthetic report', totalValue: 3650,
  startDate: '2026-01-01', endDate: '2027-01-01', amendments: [] };
const scope = amount => ({ knownSubtotal: amount, total: amount, isComplete: true, missingComponents: [] });
function row() {
  return { _id: '000000000000000000000003', contractId: contract._id, facilityId: contract.facilityId, assetId: '000000000000000000000004', requestDate: '2026-02-28T23:59:59.999Z', status: 'Completed', type: 'PM', timeLogs: [{ timeSpent: 120 }], travelLogs: [{ travelTime: 30 }],
    economics: { schemaVersion: 1, revision: 1 }, costs: { calculationVersion: 'wo-cost-v1', inputRevision: 1, cacheState: 'current',
      scopes: { internal: scope(70), vendorDirect: scope(30), directMaintenance: scope(100) },
      components: { internalLabor: scope(50), internalTravel: scope(10), internalParts: scope(10) } } };
}
const period = reportPeriod('2026-02-01', '2026-02-28');
const build = (rows, overrides = {}) => buildSigmaReport({ contract, period, generatedAt: new Date('2026-03-01'), coreClient: { get: async () => ({ data: { workOrders: rows } }) }, ...overrides });
test('strict calendar dates, inclusive end day, leap years and bounded ranges', () => {
  for (const dates of [['2026-02-30', '2026-03-01'], ['2026-1-01', '2026-01-02'], ['2026-02-01', '2026-01-01'], [undefined, '2026-01-01'], ['2020-01-01', '2026-01-01']]) assert.throws(() => reportPeriod(...dates));
  assert.equal(period.endExclusive.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(reportPeriod('2024-02-29', '2024-02-29').endExclusive.toISOString(), '2024-03-01T00:00:00.000Z');
});
test('month value, canonical costs, hours and activity agree with supporting records', async () => {
  const result = await build([row()]);
  assert.equal(result.contractValue, 280);
  assert.equal(result.costs.scopes.directMaintenance.total, 100);
  assert.deepEqual(result.activity, { total: 1, closed: 1, open: 0, preventive: 1, laborHours: 2, travelHours: 0.5 });
  assert.equal(result.workOrders[0].cost.total, 100);
  assert.equal(result.contribution, null);
  assert.equal(result.marginPercent, null);
});
test('request uses recorded Contract linkage and a clipped inclusive last millisecond', async () => {
  let called;
  await build([], { coreClient: { get: async (...args) => { called = args; return { data: { workOrders: [] } }; } } });
  assert.equal(called[0], `/workorders/by-contract/${contract._id}`);
  assert.deepEqual(called[1].params, { start: '2026-02-01T00:00:00.000Z', end: '2026-02-28T23:59:59.999Z', dateField: 'requestDate' });
});
test('partial and legacy costs remain unknown, preserving known subtotal', async () => {
  const partial = row();
  partial.costs.scopes.directMaintenance = { knownSubtotal: 70, total: null, isComplete: false, missingComponents: [{ reason: 'parts_unknown' }] };
  const result = await build([partial]);
  assert.equal(result.costs.scopes.directMaintenance.total, null);
  assert.equal(result.costs.scopes.directMaintenance.knownSubtotal, 70);
  assert.equal(result.workOrders[0].cost.isComplete, false);
  const legacy = row(); delete legacy.economics;
  assert.equal((await build([legacy])).costs.scopes.directMaintenance.total, null);
});
test('cross-facility, wrong Contract, dates outside range, duplicates and archived rows fail closed', async () => {
  for (const override of [{ facilityId: '000000000000000000000009' }, { contractId: null }, { requestDate: '2026-03-01' }, { requestDate: '2026-01-31' }, { requestDate: 'invalid' }, { status: 'Archived' }, { _id: null }]) {
    await assert.rejects(build([{ ...row(), ...override }]));
  }
  await assert.rejects(build([row(), row()]));
});
test('missing, truncated-shape and failed upstream data cannot become an empty successful report', async () => {
  for (const data of [{}, { items: [] }, { workOrders: null }]) await assert.rejects(build([], { coreClient: { get: async () => ({ data }) } }));
  await assert.rejects(build([], { coreClient: { get: async () => { throw new Error('unavailable'); } } }));
});
test('outside term is empty, not a cross-period query; invalid financial inputs fail', async () => {
  const result = await build([], { period: reportPeriod('2025-01-01', '2025-01-31'), coreClient: { get: () => assert.fail('must not query') } });
  assert.equal(result.contractValue, 0);
  assert.equal(result.activity.total, 0);
  assert.equal(result.period.effectiveStart, null);
  await assert.rejects(build([], { contract: { ...contract, totalValue: null } }));
  await assert.rejects(build([], { contract: { ...contract, startDate: null } }));
});
test('applied signed amendments affect only their effective portion', async () => {
  const amended = { ...contract, amendments: [{ status: 'applied', date: '2026-02-15', totalDelta: -365 }, { status: 'draft', date: '2026-02-01', totalDelta: 9999 }] };
  assert.equal((await build([], { contract: amended })).contractValue, 266);
});
test('vendor agreements disclose exclusions and never certify contribution', async () => {
  const result = await build([row()], { contract: { ...contract, vendorLinks: [{ annualCost: 365 }] } });
  assert.ok(result.warnings.some(warning => warning.includes('Recurring vendor')));
  assert.equal(result.costs.scopes.directMaintenance.total, 100);
  assert.equal(result.contribution, null);
});
