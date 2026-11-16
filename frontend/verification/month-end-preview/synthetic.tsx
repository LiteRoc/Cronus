import { createContext, useContext } from 'react';
import type { MonthEndFilters, MonthEndReport } from '../../src/types/MonthEndReport';
import type { WorkOrderReport } from '../../src/types/WorkOrderReport';
export const hospitalA = '000000000000000000000001', hospitalB = '000000000000000000000002';
export type Scenario = 'sample' | 'pages' | 'empty' | 'unavailable';
export const settings: { scenario: Scenario } = { scenario: 'sample' };
export const PreviewContext = createContext({ role: 'admin', facilityId: hospitalA as string | null });
export const useUser = () => ({ user: { _id: 'synthetic-month-user', role: useContext(PreviewContext).role } });
export const useFacility = () => ({ selectedFacilityId: useContext(PreviewContext).facilityId });
const cost = (amount = 100, partial = false) => ({ knownSubtotal: amount, total: partial ? null : amount, isComplete: !partial, missingComponents: partial ? [{ reason: 'travel_policy_unapproved' }] : [] });
const summary = (count: number, partial = false): WorkOrderReport['summary'] => ({ count, overdue: 0, missingDueDates: count, missingRequestDates: 0, unavailableAssets: 0, archived: 0, cost: cost(count * 100, partial) });
export function fixture(filters: MonthEndFilters = { month: '2026-10', includeArchived: 'false' }, count = 2): MonthEndReport {
  const facility = { id: hospitalA, name: 'Synthetic Hospital A' }, generatedAt = '2026-11-16T12:00:00.000Z';
  const row = (i: number): MonthEndReport['activity']['rows'][number] => ({ id: String(300 + i).padStart(24, '0'), number: 9301 + i, status: 'Completed', priority: 'Normal', type: i % 2 ? 'Corrective Maintenance' : 'Planned Maintenance', description: `Synthetic completion ${i + 1}`,
    asset: { id: String(700 + i).padStart(24, '0'), controlNumber: `SYN-MONTH-${i + 1}`, manufacturer: 'Synthetic Medical', model: 'Pump' }, requested: '2026-09-01T12:00:00.000Z', scheduled: null, due: null, completed: `${filters.month}-${String(i % 28 + 1).padStart(2, '0')}T12:00:00.000Z`, ageDays: null, overdue: null, cost: cost(100, i === 1), laborHours: 2, travelHours: 0.5, invalidTimeEntries: 0, vendorLaborHours: i === 1 ? 4 : null, vendorTravelHours: null });
  const rows = Array.from({ length: count }, (_, i) => row(i));
  if (filters.includeArchived === 'true' && count) rows.push({ ...row(count), status: 'Archived' });
  const backlogRows: WorkOrderReport['rows'] = count ? [0, 1].map(i => ({ ...row(100 + i), status: 'Open', priority: i ? 'Normal' : 'High', completed: null, due: i ? null : '2026-11-15T12:00:00.000Z', ageDays: 15, overdue: i ? null : true })) : [];
  const backlog: WorkOrderReport = { schemaVersion: 'work-order-report-v1', generatedAt, facility, filters: { mode: 'open' }, rows: backlogRows, summary: { ...summary(backlogRows.length), overdue: count ? 1 : 0, missingDueDates: count ? 1 : 0 }, notes: ['Current backlog at generation, not month-end backlog'] };
  const start = new Date(`${filters.month}-01T00:00:00.000Z`), end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  const types = new Map<string, number>(); rows.forEach(r => types.set(r.type, (types.get(r.type) || 0) + 1));
  return { schemaVersion: 'month-end-v1', generatedAt, facility, filters, period: { month: filters.month, start: start.toISOString(), endExclusive: end.toISOString(), isInProgress: filters.month === '2026-11' },
    activity: { summary: { ...summary(rows.length, rows.length > 1), archived: rows.filter(r => r.status === 'Archived').length, laborHours: rows.length * 2, travelHours: rows.length * 0.5, invalidTimeEntries: 0, vendorKnownLaborHours: rows.length > 1 ? 4 : 0, vendorKnownTravelHours: 0, vendorMissingLaborHours: 0, vendorMissingTravelHours: rows.length > 1 ? 1 : 0 }, rows }, backlog,
    backlogBreakdown: [{ label: 'Open PM', count: count ? 1 : 0, overdue: count ? 1 : 0, missingDueDates: 0 }, { label: 'Open corrective', count: count ? 1 : 0, overdue: 0, missingDueDates: count ? 1 : 0 }, { label: 'Other open work', count: 0, overdue: 0, missingDueDates: 0 }],
    charts: { completedByType: [...types].map(([label, count]) => ({ label, count })), backlogByPriority: count ? [{ label: 'High', count: 1 }, { label: 'Normal', count: 1 }] : [], dailyCompletions: Array.from({ length: Math.round((+end - +start) / 86400000) }, (_, i) => { const date = `${filters.month}-${String(i + 1).padStart(2, '0')}`; return { date, count: rows.filter(r => r.completed?.startsWith(date)).length }; }) },
    notes: ['Synthetic completion cohort and current backlog are separate. Whole-WO hours and costs are not monthly hours worked or expenses incurred.', 'Charts count captured records. No historical snapshot, PM compliance, financial margin or completeness certification.'] };
}
export async function getMonthEndReport(facilityId: string, filters: MonthEndFilters): Promise<MonthEndReport> {
  if (settings.scenario === 'unavailable' || !/^2026-(0[1-9]|1[01])$/.test(filters.month)) throw Object.assign(new Error('Synthetic unavailable'), { response: { data: { error: 'Synthetic report unavailable. Select January–November 2026. No live request sent.' } } });
  const report = fixture(filters, settings.scenario === 'empty' || facilityId === hospitalB ? 0 : settings.scenario === 'pages' ? 55 : 2);
  report.facility = { id: facilityId, name: facilityId === hospitalA ? 'Synthetic Hospital A' : 'Synthetic Hospital B' }; report.backlog.facility = report.facility; return report;
}
export async function getInventoryOptions() { return []; }
export async function getInventoryReport(): Promise<never> { throw new Error('Inventory disabled in this synthetic preview'); }
