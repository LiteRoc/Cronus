import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { parseFilters, periodFor, queries, buildReport } = require('../yearEndReport');
const now = new Date('2026-11-17T12:00:00Z');
test.each([{}, { yearEnding: '202' }, { yearEnding: '1900' }, { yearEnding: '2028' }, { yearEnding: ['2026'] }, { yearEnding: '2026', startMonth: '0' }, { yearEnding: '2026', startMonth: '13' }, { yearEnding: '2026', includeArchived: 'yes' }, { yearEnding: '2026', facilityId: 'override' }])('invalid year filters fail closed %j', q => { expect(() => parseFilters(q, now)).toThrow(); });
test('calendar and fiscal year end labels, including current fiscal year ending next year', () => {
  expect(periodFor(parseFilters({ yearEnding: '2026' }, now))).toMatchObject({ start: '2026-01-01T00:00:00.000Z', endExclusive: '2027-01-01T00:00:00.000Z' });
  expect(periodFor(parseFilters({ yearEnding: '2026', startMonth: '7' }, now))).toMatchObject({ start: '2025-07-01T00:00:00.000Z', endExclusive: '2026-07-01T00:00:00.000Z' });
  expect(parseFilters({ yearEnding: '2027', startMonth: '7' }, now).yearEnding).toBe('2027');
});
test('annual query cutoff never includes unobserved future completion timestamps', () => {
  const q = queries('f', parseFilters({ yearEnding: '2026', includeArchived: 'true' }, now), now);
  expect(q.completed).toMatchObject({ facilityId: 'f', deletedAt: null, status: { $in: ['Completed', 'Archived'] }, completionDate: { $gte: new Date('2026-01-01'), $lt: now } }); expect(q.backlog).not.toHaveProperty('completionDate');
});
test('monthly counts and annual totals reconcile without summing rounded monthly hours; future months null', () => {
  const completed = [{ _id: 'a', completionDate: '2026-01-15', workOrderType: 'PM', timeLogs: [{ timeSpent: 1 }] }, { _id: 'b', completionDate: '2026-02-15', workOrderType: 'CM', timeLogs: [{ timeSpent: 1 }] }];
  const input = { facility: { _id: 'f' }, filters: parseFilters({ yearEnding: '2026' }, now), generatedAt: now, completed, backlog: [{ _id: 'open', workOrderType: 'PM' }] }, before = structuredClone(input);
  const r = buildReport(input); expect(r.activity.summary.laborHours).toBe(0.03); expect(r.months.reduce((s, m) => s + m.summary.count, 0)).toBe(2); expect(r.months[0].summary.laborHours).toBe(0.02); expect(r.months).toHaveLength(12); expect(r.charts.monthlyCompletions[11].count).toBeNull(); expect(r.months[10].state).toBe('in_progress'); expect(r.backlogBreakdown[0].count).toBe(1); expect(r.activity.summary.cost.total).toBeNull(); expect(input).toEqual(before);
});
test('fiscal months ordered across years; leap day and empty months handled', () => {
  const filters = parseFilters({ yearEnding: '2024', startMonth: '7' }, now);
  const r = buildReport({ facility: { _id: 'f' }, filters, generatedAt: now, completed: [{ _id: 'a', completionDate: '2024-02-29' }], backlog: [] });
  expect(r.months[0].month).toBe('2023-07'); expect(r.months[11].month).toBe('2024-06'); expect(r.months[7].summary.count).toBe(1); expect(r.period.isInProgress).toBe(false); expect(r.months[0].summary.count).toBe(0);
});
