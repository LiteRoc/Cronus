import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseFilters, buildReport } = require('../assetHistoryReport');
const base = () => ({ asset: { _id: 'asset', ctrlNumber: 'SYN-1', facilityId: 'facility', departmentId: 'missing' }, facility: { _id: 'facility', name: 'Synthetic' }, department: null, filters: { controlNumber: 'SYN-1' }, workOrders: [] });
const native = () => ({ _id: 'work-order', workOrderNumber: 1, workOrderType: 'PM', requestDate: new Date('2026-02-28'), status: 'Archived',
  economics: { schemaVersion: 1, revision: 1, origin: 'native' }, timeLogs: [{ timeSpent: 120, laborRate: 50, laborCost: 100, workDate: '2026-02-28', description: 'Synthetic repair note',
    pricing: { version: 1, basis: 'documented', sourceKind: 'synthetic', sourceId: 'test', capturedBy: 'synthetic', capturedAt: '2026-02-28' } }], travelLogs: [], partsUsed: [] });
test('filters normalize identity and validate inclusive calendar range', () => {
  expect(parseFilters({ assetId: 'ABCDEF000000000000000001', startDate: '2024-02-29', endDate: '2024-02-29' }).assetId).toBe('abcdef000000000000000001');
  expect(parseFilters({ controlNumber: ' SYN-1 ' })).toEqual({ controlNumber: 'SYN-1' });
});
test.each([{}, { assetId: 'bad' }, { assetId: '000000000000000000000001', controlNumber: 'A' }, { controlNumber: 'A', startDate: '2026-01-01' },
  { controlNumber: 'A', startDate: '2026-02-30', endDate: '2026-03-01' }, { controlNumber: 'A', startDate: '2026-03-01', endDate: '2026-02-28' },
  { controlNumber: ['A'] }, { controlNumber: 'A', facilityId: 'override' }])('rejects invalid history filters %j', filters => { expect(() => parseFilters(filters)).toThrow(); });
test('canonical known cost, service notes and archived records are represented without exposing raw pricing', () => {
  const row = native(); const input = { ...base(), workOrders: [row] }; const snapshot = structuredClone(input);
  const report = buildReport(input);
  expect(report.summary).toMatchObject({ workOrderCount: 1, archivedCount: 1, laborHours: 2, fullyPricedCount: 1 });
  expect(report.summary.scopes.directMaintenance).toMatchObject({ total: 100, knownSubtotal: 100, isComplete: true });
  expect(report.rows[0].serviceNotes[0].description).toBe('Synthetic repair note');
  expect(report.rows[0]).not.toHaveProperty('economics'); expect(report.rows[0]).not.toHaveProperty('pricing');
  expect(input).toEqual(snapshot);
});
test('partial travel and legacy scope stay unknown while known labor subtotal remains visible', () => {
  const row = native(); row.travelLogs = [{ travelTime: 30 }];
  const partial = buildReport({ ...base(), workOrders: [row] });
  expect(partial.summary.scopes.directMaintenance).toMatchObject({ knownSubtotal: 100, total: null, isComplete: false });
  expect(partial.summary.travelHours).toBe(0.5);
  delete row.economics;
  const legacy = buildReport({ ...base(), workOrders: [row] });
  expect(legacy.summary.scopes.directMaintenance.total).toBeNull();
  expect(legacy.rows[0].costState).toBe('legacy');
});
test('missing identities, dates and current catalog labels remain explicit', () => {
  const row = native(); row.requestDate = null; row.partsUsed = [{ partId: 'missing', quantity: 2, note: 'Recorded note' }];
  const report = buildReport({ ...base(), workOrders: [row] });
  expect(report.asset.departmentState).toBe('unavailable'); expect(report.summary.missingRequestDates).toBe(1);
  expect(report.rows[0].parts[0]).toMatchObject({ id: 'missing', number: '', quantity: 2, referenceState: 'unavailable' });
  const resolved = buildReport({ ...base(), workOrders: [row], parts: [{ _id: 'missing', partNumber: 'CURRENT-PART', description: 'Current label', price: 9999 }] });
  expect(resolved.rows[0].parts[0]).toMatchObject({ number: 'CURRENT-PART', referenceState: 'resolved_current_catalog' });
  expect(resolved.rows[0].parts[0]).not.toHaveProperty('price');
});
test('invalid internal time is disclosed; vendor hours stay separate', () => {
  const row = native(); row.timeLogs.push({ timeSpent: '120' }); row.vendorService = { vendorName: 'Synthetic vendor', laborHours: 9, travelHours: 3 };
  const report = buildReport({ ...base(), workOrders: [row] });
  expect(report.summary.laborHours).toBe(2); expect(report.summary.invalidTimeEntries).toBe(1); expect(report.rows[0].vendor.laborHours).toBe(9);
});
test('empty recorded history is explicit, not a claim that no maintenance ever occurred', () => {
  const report = buildReport(base()); expect(report.rows).toEqual([]); expect(report.summary.workOrderCount).toBe(0);
  expect(report.notes.join(' ')).toContain('not an immutable historical snapshot');
});
test('aggregate hours are rounded once after summing recorded minutes', () => {
  const rows = Array.from({ length: 3 }, () => ({ ...native(), timeLogs: [{ timeSpent: 1 }] }));
  expect(buildReport({ ...base(), workOrders: rows }).summary.laborHours).toBe(0.05);
});
