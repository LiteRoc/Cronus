import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
let query;
let found = null;
mock.module('../../models/Contract.js', { defaultExport: { findOne: filter => { query = filter; return { lean: async () => found }; } } });
const { getSigmaContractReport } = await import('../sigmaReportController.js');
const facilityId = '000000000000000000000002', contractId = '000000000000000000000001';
async function run(overrides = {}) {
  query = undefined;
  const req = { user: { role: 'admin' }, headers: { 'x-facility-id': facilityId }, params: { id: contractId }, query: { startDate: '2026-01-01', endDate: '2026-01-31' },
    core: { get: async () => ({ data: { workOrders: [] } }) }, ...overrides };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader() {} };
  await getSigmaContractReport(req, res);
  return res;
}
test('unauthenticated and non-administrators cannot read financial report', async () => {
  assert.equal((await run({ user: null })).code, 401);
  for (const role of ['technician', 'customer', 'viewer', null]) {
    assert.equal((await run({ user: { role } })).code, 403);
    assert.equal(query, undefined);
  }
});
test('selected Facility, Contract ID and dates are required before querying', async () => {
  for (const overrides of [{ headers: {} }, { headers: { 'x-facility-id': 'bad' } }, { params: { id: 'bad' } }, { query: { startDate: '2026-02-30', endDate: '2026-03-01' } }]) {
    assert.equal((await run(overrides)).code, 400); assert.equal(query, undefined);
  }
});
test('lookup uses exact Facility equality and missing/cross-facility Contracts return 404', async () => {
  found = null;
  assert.equal((await run()).code, 404);
  assert.deepEqual(query, { _id: contractId, facilityId });
});
test('only active or historical customer Contracts are reported', async () => {
  for (const [type, status] of [['vendor', 'active'], ['customer', 'draft'], ['customer', 'approved']]) {
    found = { type, status }; assert.equal((await run()).code, 400);
  }
});
test('valid report succeeds; upstream failure is unavailable without leaking detail', async () => {
  found = { _id: contractId, facilityId, type: 'customer', status: 'active', totalValue: 3650, startDate: '2026-01-01', endDate: '2027-01-01' };
  assert.equal((await run()).data.data.contractValue, 310);
  const failed = await run({ core: { get: async () => { throw new Error('private upstream diagnostic'); } } });
  assert.equal(failed.code, 503);
  assert.ok(!JSON.stringify(failed.data).includes('private'));
});
