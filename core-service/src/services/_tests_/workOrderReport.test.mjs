import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseFilters, queryFor, buildReport } = require('../workOrderReport');
const now = new Date('2026-11-16T12:00:00Z');
const closed = { mode: 'closed', startDate: '2026-02-01', endDate: '2026-02-28' };
test('open cohort is explicit and never includes archived or completed', () => {
  expect(queryFor('f', parseFilters({}))).toEqual({ facilityId: 'f', deletedAt: null, status: { $in: ['Requested', 'Open', 'In Progress'] } });
});
test('closed uses completion timestamps with exclusive next-day upper bound', () => {
  const query = queryFor('f', parseFilters({ ...closed, includeArchived: 'true', priority: 'High', workOrderType: ' PM ' }));
  expect(query.status.$in).toEqual(['Completed', 'Archived']); expect(query.completionDate).toEqual({ $gte: new Date('2026-02-01'), $lt: new Date('2026-03-01') });
  expect(query).toMatchObject({ priority: 'High', workOrderType: 'PM' });
});
test.each([{ mode: 'all' }, { mode: ['open'] }, { facilityId: 'f' }, { mode: 'closed' }, { ...closed, startDate: '2026-02-30' }, { ...closed, endDate: '2026-01-01' }, { startDate: '2026-01-01' }, { includeArchived: 'true' }, { priority: 'Urgent' }, { ...closed, includeArchived: 'yes' }, { workOrderType: 'a'.repeat(121) }])('invalid filters fail closed %j', filters => { expect(() => parseFilters(filters)).toThrow(); });
test('current age and due evidence use generation timestamp, with missing and future dates unknown', () => {
  const report = buildReport({ facility: { _id: 'f', name: 'Synthetic' }, filters: parseFilters({}), generatedAt: now,
    assets: [{ _id: 'a', ctrlNumber: 'SYN-1' }], workOrders: [
      { _id: '1', assetId: 'a', status: 'Open', requestDate: '2026-11-14T13:00:00Z', dueDate: '2026-11-16T11:59:59Z' },
      { _id: '2', assetId: 'foreign', requestDate: '2026-11-17', dueDate: now }, { _id: '3' }] });
  expect(report.rows[0]).toMatchObject({ ageDays: 1, overdue: true, asset: { controlNumber: 'SYN-1' } });
  expect(report.rows[1]).toMatchObject({ ageDays: null, overdue: false, asset: null });
  expect(report.rows[2]).toMatchObject({ ageDays: null, overdue: null });
  expect(report.summary).toMatchObject({ count: 3, overdue: 1, unavailableAssets: 2, missingDueDates: 1, missingRequestDates: 1 });
});
test('empty report and legacy costs do not invent economic evidence; input remains unchanged', () => {
  const input = { facility: { _id: 'f' }, filters: parseFilters(closed), generatedAt: now, workOrders: [{ _id: '1', status: 'Archived', costs: { total: 999 } }] };
  const before = structuredClone(input); const report = buildReport(input);
  expect(report.summary.archived).toBe(1); expect(report.summary.cost.total).toBeNull(); expect(report.rows[0].ageDays).toBeNull();
  expect(report.rows[0]).not.toHaveProperty('costs'); expect(input).toEqual(before);
  expect(buildReport({ ...input, workOrders: [] }).summary.count).toBe(0);
});
test('canonical documented labor remains known while unpriced travel makes aggregate incomplete', () => {
  const native = { _id: '1', economics: { schemaVersion: 1, revision: 1, origin: 'native' }, partsUsed: [], travelLogs: [],
    timeLogs: [{ timeSpent: 120, laborRate: 50, laborCost: 100, pricing: { version: 1, basis: 'documented', sourceKind: 'synthetic', sourceId: 'test', capturedBy: 'synthetic', capturedAt: '2026-02-28' } }] };
  const input = { facility: { _id: 'f' }, filters: parseFilters({}), generatedAt: now, workOrders: [native] };
  expect(buildReport(input).summary.cost).toMatchObject({ knownSubtotal: 100, total: 100, isComplete: true });
  native.travelLogs.push({ travelTime: 30 });
  expect(buildReport(input).summary.cost).toMatchObject({ knownSubtotal: 100, total: null, isComplete: false });
});
