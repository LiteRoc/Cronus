import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseFilters, queryFor, buildReport } = require('../workOrderReport');
const now = new Date('2026-11-16T12:00:00Z');
test('PM query uses exact recognized types, current open statuses and selected facility', () => {
  expect(queryFor('f', parseFilters({ mode: 'pm' }), now)).toEqual({ facilityId: 'f', deletedAt: null, status: { $in: ['Requested', 'Open', 'In Progress'] }, workOrderType: { $in: ['Planned Maintenance', 'Preventive Maintenance', 'PM'] } });
});
test('generation boundaries are shared by due query and report; missing and next30 are explicit', () => {
  expect(queryFor('f', parseFilters({ mode: 'pm', dueStatus: 'overdue' }), now).dueDate).toEqual({ $type: 'date', $lt: now });
  expect(queryFor('f', parseFilters({ mode: 'pm', dueStatus: 'next30' }), now).dueDate).toEqual({ $type: 'date', $gte: now, $lt: new Date('2026-12-16T12:00:00Z') });
  expect(queryFor('f', parseFilters({ mode: 'pm', dueStatus: 'missing' }), now).dueDate).toBeNull();
  const report = buildReport({ facility: { _id: 'f' }, filters: parseFilters({ mode: 'pm' }), generatedAt: now, workOrders: [{ _id: 'a', dueDate: '2026-11-16T11:59:59Z', requestDate: '2026-11-15T12:00:00Z' }, { _id: 'b', dueDate: now }, { _id: 'c' }] });
  expect(report.rows.map(r => r.overdue)).toEqual([true, false, null]); expect(report.rows[0].ageDays).toBe(1); expect(report.summary.missingDueDates).toBe(1);
});
test('paired due range uses inclusive leap day and optional priority', () => {
  const q = queryFor('f', parseFilters({ mode: 'pm', dueStatus: 'range', startDate: '2024-02-29', endDate: '2024-02-29', priority: 'High' }), now);
  expect(q.dueDate).toEqual({ $gte: new Date('2024-02-29'), $lt: new Date('2024-03-01') }); expect(q.priority).toBe('High');
});
test.each([{ dueStatus: 'all' }, { mode: 'closed', dueStatus: 'overdue' }, { mode: 'pm', dueStatus: 'bad' }, { mode: 'pm', workOrderType: 'CM' }, { mode: 'pm', includeArchived: 'true' }, { mode: 'pm', startDate: '2026-01-01' }, { mode: 'pm', dueStatus: 'range' }, { mode: 'pm', dueStatus: 'range', startDate: '2026-02-30', endDate: '2026-03-01' }, { mode: 'pm', dueStatus: ['all'] }])('invalid PM filters rejected %j', f => { expect(() => parseFilters(f)).toThrow(); });
