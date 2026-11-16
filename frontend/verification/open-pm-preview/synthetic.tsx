import { createContext, useContext } from 'react';
import type { WorkOrderReport, WorkOrderReportFilters } from '../../src/types/WorkOrderReport';
export const hospitalA = '000000000000000000000001', hospitalB = '000000000000000000000002';
export type Scenario = 'sample' | 'pages' | 'empty' | 'unavailable';
export const settings: { scenario: Scenario } = { scenario: 'sample' };
export const PreviewContext = createContext({ role: 'admin', facilityId: hospitalA as string | null });
export const useUser = () => ({ user: { _id: 'synthetic-pm-user', role: useContext(PreviewContext).role } });
export const useFacility = () => ({ selectedFacilityId: useContext(PreviewContext).facilityId });
const now = new Date('2026-11-16T12:00:00.000Z');
export async function getWorkOrderReport(facilityId: string, filters: WorkOrderReportFilters): Promise<WorkOrderReport> {
  if (settings.scenario === 'unavailable' || filters.mode !== 'pm') throw Object.assign(new Error('Synthetic unavailable'), { response: { data: { error: 'Synthetic PM report unavailable. Use Open PM mode. No live request was sent.' } } });
  const dueDates = ['2026-11-15T12:00:00.000Z', now.toISOString(), '2026-12-16T11:59:59.999Z', '2026-12-16T12:00:00.000Z', null, null];
  let rows: WorkOrderReport['rows'] = Array.from({ length: settings.scenario === 'pages' ? 55 : 6 }, (_, i) => ({
    id: String(200 + i).padStart(24, '0'), number: 9201 + i, status: ['Requested', 'Open', 'In Progress'][i % 3], priority: i === 0 ? 'High' : 'Normal', type: ['Planned Maintenance', 'Preventive Maintenance', 'PM'][i % 3], description: `Synthetic PM request ${i + 1}`,
    asset: i === 5 ? null : { id: String(600 + i).padStart(24, '0'), controlNumber: `SYN-PM-${i + 1}`, manufacturer: 'Synthetic Medical', model: 'Pump' },
    requested: '2026-11-01T12:00:00.000Z', scheduled: null, due: dueDates[i % 6], completed: null, ageDays: 15,
    overdue: dueDates[i % 6] ? +new Date(dueDates[i % 6]!) < +now : null,
    cost: { knownSubtotal: 100, total: i === 1 ? null : 100, isComplete: i !== 1, missingComponents: i === 1 ? [{ reason: 'travel_policy_unapproved' }] : [] },
  }));
  rows = rows.filter(r => {
    if (filters.priority && r.priority !== filters.priority) return false;
    if (filters.dueStatus === 'missing') return !r.due;
    if (filters.dueStatus === 'overdue') return r.overdue === true;
    if (filters.dueStatus === 'next30') return !!r.due && +new Date(r.due) >= +now && +new Date(r.due) < +now + 30 * 86400000;
    if (filters.dueStatus === 'range') return !!r.due && !!filters.startDate && !!filters.endDate && r.due.slice(0, 10) >= filters.startDate && r.due.slice(0, 10) <= filters.endDate;
    return true;
  }).sort((a, b) => (a.due || '').localeCompare(b.due || '') || a.id.localeCompare(b.id));
  if (settings.scenario === 'empty' || facilityId === hospitalB) rows = [];
  const known = rows.length * 100, complete = rows.every(r => r.cost.isComplete);
  return { schemaVersion: 'work-order-report-v1', generatedAt: now.toISOString(), facility: { id: facilityId, name: facilityId === hospitalA ? 'Synthetic Hospital A' : 'Synthetic Hospital B' }, filters,
    rows, summary: { count: rows.length, overdue: rows.filter(r => r.overdue).length, missingDueDates: rows.filter(r => !r.due).length, missingRequestDates: 0, unavailableAssets: rows.filter(r => !r.asset).length, archived: 0,
      cost: { knownSubtotal: known, total: complete ? known : null, isComplete: complete, missingComponents: rows.flatMap(r => r.cost.missingComponents) } },
    notes: ['Synthetic current outstanding PM Work Orders, not all asset PM obligations or a PM compliance denominator.', 'Exact types: Planned Maintenance, Preventive Maintenance, PM. Current Requested, Open, In Progress only.', 'Due selection uses WO due timestamps. Next30 includes generation, excludes exactly30 days later. Missing dates stay unknown. Costs are current whole-WO amounts, not period expenses.'] };
}
export async function getInventoryOptions() { return []; }
export async function getInventoryReport(): Promise<never> { throw new Error('Inventory disabled in this synthetic preview'); }
