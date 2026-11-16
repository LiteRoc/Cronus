import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { parseFilters, periodFor, queries, buildReport } = require('../monthEndReport');
const now = new Date('2026-11-16T12:00:00Z'), filters = { month: '2026-02', includeArchived: 'false' };
test.each([{}, { month: '2026-13' }, { month: '2026-2' }, { month: '1899-01' }, { month: '2026-12' }, { month: ['2026-02'] }, { month: '2026-02', includeArchived: 'yes' }, { month: '2026-02', facilityId: 'override' }])('invalid filters rejected %j', q => { expect(() => parseFilters(q, now)).toThrow(); });
test('month boundaries handle leap and year rollover; current month permitted', () => {
  expect(periodFor({ month: '2024-02' })).toMatchObject({ start: '2024-02-01T00:00:00.000Z', endExclusive: '2024-03-01T00:00:00.000Z' });
  expect(periodFor({ month: '2025-12' }).endExclusive).toBe('2026-01-01T00:00:00.000Z'); expect(parseFilters({ month: '2026-11' }, now).includeArchived).toBe('false');
});
test('cohorts use completionDate and current open statuses independently', () => {
  const q = queries('f', { ...filters, includeArchived: 'true' }); expect(q.completed).toMatchObject({ facilityId: 'f', deletedAt: null, status: { $in: ['Completed', 'Archived'] }, completionDate: { $gte: new Date('2026-02-01'), $lt: new Date('2026-03-01') } });
  expect(q.backlog.status.$in).toEqual(['Requested', 'Open', 'In Progress']); expect(q.backlog).not.toHaveProperty('completionDate');
});
test('charts reconcile to cohort counts; time rounds after summing, vendor hours separate, no input mutation', () => {
  const completed = [{ _id: 'a', status: 'Completed', workOrderType: 'PM', completionDate: '2026-02-01', timeLogs: [{ timeSpent: 1 }], vendorService: { laborHours: 4 } }, { _id: 'b', status: 'Archived', workOrderType: 'PM', completionDate: '2026-02-28', timeLogs: [{ timeSpent: 1 }, { timeSpent: -1 }], travelLogs: [{ travelTime: 30 }] }];
  const input = { facility: { _id: 'f' }, filters, completed, backlog: [{ _id: 'c', priority: 'High', dueDate: '2026-11-01' }], generatedAt: now }, before = structuredClone(input);
  const r = buildReport(input); expect(r.activity.summary).toMatchObject({ count: 2, laborHours: 0.03, travelHours: 0.5, invalidTimeEntries: 1, vendorKnownLaborHours: 4, vendorMissingTravelHours: 1 });
  expect(r.activity.summary.cost.total).toBeNull(); expect(r.backlog.summary).toMatchObject({ count: 1, overdue: 1 });
  expect(r.charts.completedByType).toEqual([{ label: 'PM', count: 2 }]); expect(r.charts.dailyCompletions).toHaveLength(28); expect(r.charts.dailyCompletions.reduce((s, r) => s + r.count, 0)).toBe(2); expect(input).toEqual(before);
});
test('canonical documented costs retained and empty/current-month states explicit', () => {
  const row = { _id: 'a', economics: { schemaVersion: 1, revision: 1, origin: 'native' }, timeLogs: [{ timeSpent: 60, laborRate: 100, laborCost: 100, pricing: { version: 1, basis: 'documented', sourceKind: 'synthetic', sourceId: 'test', capturedBy: 'synthetic', capturedAt: '2026-02-28' } }], partsUsed: [], travelLogs: [] };
  const input = { facility: { _id: 'f' }, filters: { month: '2026-11', includeArchived: 'false' }, completed: [row], backlog: [], generatedAt: now };
  expect(buildReport(input).activity.summary.cost).toMatchObject({ knownSubtotal: 100, total: 100 }); expect(buildReport(input).period.isInProgress).toBe(true);
  const r = buildReport({ ...input, completed: [] }); expect(r.charts.completedByType).toEqual([]); expect(r.activity.summary.count).toBe(0); expect(r.charts.dailyCompletions).toHaveLength(30);
});
test('current backlog categories are exhaustive, disjoint and preserve unknown types', () => {
  const types = ['Planned Maintenance', 'Preventive Maintenance', 'PM', 'Corrective Maintenance', 'CM', 'Inspection', '', 'pm'];
  const r = buildReport({ facility: { _id: 'f' }, filters, completed: [], backlog: types.map((type, i) => ({ _id: String(i), workOrderType: type, dueDate: i === 0 ? '2026-01-01' : null })), generatedAt: now });
  expect(r.backlogBreakdown).toEqual([{ label: 'Open PM', count: 3, overdue: 1, missingDueDates: 2 }, { label: 'Open corrective', count: 2, overdue: 0, missingDueDates: 2 }, { label: 'Other open work', count: 3, overdue: 0, missingDueDates: 3 }]);
  expect(r.backlogBreakdown.reduce((s, g) => s + g.count, 0)).toBe(r.backlog.summary.count);
});
