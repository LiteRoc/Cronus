import { createContext, useContext } from 'react';
import type { WorkOrderReport, WorkOrderReportFilters } from '../../src/types/WorkOrderReport';
export const hospitalA = '000000000000000000000001', hospitalB = '000000000000000000000002';
export type Scenario = 'sample' | 'pages' | 'empty' | 'unavailable';
export const settings: { scenario: Scenario } = { scenario: 'sample' };
export const PreviewContext = createContext({ role: 'admin', facilityId: hospitalA as string | null });
export const useUser = () => ({ user: { _id: 'synthetic-work-order-user', role: useContext(PreviewContext).role } });
export const useFacility = () => ({ selectedFacilityId: useContext(PreviewContext).facilityId });
const cost = (partial = false) => ({ knownSubtotal: 100, total: partial ? null : 100, isComplete: !partial, missingComponents: partial ? [{ reason: 'travel_policy_unapproved' }] : [] });
export async function getWorkOrderReport(facilityId: string, filters: WorkOrderReportFilters): Promise<WorkOrderReport> {
  if (settings.scenario === 'unavailable') throw Object.assign(new Error('Synthetic unavailable'), { response: { data: { error: 'Synthetic report unavailable. No live request was sent.' } } });
  const generatedAt = '2026-11-16T12:00:00.000Z';
  let rows: WorkOrderReport['rows'] = Array.from({ length: settings.scenario === 'pages' ? 55 : 3 }, (_, i) => ({
    id: String(100 + i).padStart(24, '0'), number: 9101 + i, status: filters.mode === 'open' ? ['Requested', 'Open', 'In Progress'][i % 3] : i === 2 ? 'Archived' : 'Completed',
    priority: i === 0 ? 'High' : 'Normal', type: i === 0 ? 'Corrective Maintenance' : 'Preventive Maintenance', description: `Synthetic service request ${i + 1}`,
    asset: i === 2 ? null : { id: String(500 + i).padStart(24, '0'), controlNumber: `SYN-WO-${i + 1}`, manufacturer: 'Synthetic Medical', model: 'Pump' },
    requested: '2026-11-01T12:00:00.000Z', scheduled: null, due: i === 0 ? '2026-11-15T12:00:00.000Z' : null,
    completed: filters.mode === 'closed' ? '2026-11-15T12:00:00.000Z' : null,
    ageDays: filters.mode === 'open' ? 15 : null, overdue: filters.mode === 'open' && i === 0 ? true : null, cost: cost(i === 1),
  }));
  if (filters.mode === 'closed') rows = rows.filter(r => (r.status !== 'Archived' || filters.includeArchived === 'true') && !!filters.startDate && !!filters.endDate && r.completed!.slice(0, 10) >= filters.startDate && r.completed!.slice(0, 10) <= filters.endDate);
  if (filters.priority) rows = rows.filter(r => r.priority === filters.priority);
  const exactType = filters.workOrderType?.trim();
  if (exactType) rows = rows.filter(r => r.type === exactType);
  if (settings.scenario === 'empty' || facilityId === hospitalB) rows = [];
  const known = rows.reduce((s, r) => s + r.cost.knownSubtotal, 0), complete = rows.every(r => r.cost.isComplete);
  return { schemaVersion: 'work-order-report-v1', generatedAt, facility: { id: facilityId, name: facilityId === hospitalA ? 'Synthetic Hospital A' : 'Synthetic Hospital B' }, filters,
    rows, summary: { count: rows.length, overdue: rows.filter(r => r.overdue).length, missingDueDates: rows.filter(r => !r.due).length, missingRequestDates: 0, unavailableAssets: rows.filter(r => !r.asset).length, archived: rows.filter(r => r.status === 'Archived').length,
      cost: { knownSubtotal: known, total: complete ? known : null, isComplete: complete, missingComponents: rows.flatMap(r => r.cost.missingComponents) } },
    notes: ['Synthetic data only. Current statuses; not an historical backlog snapshot.', 'Completion-date filtering uses UTC inclusive days. Whole-Work-Order costs are not period expenses.', 'Unknown costs remain unknown. Asset labels are current references. No PM compliance is inferred.'] };
}
export async function getInventoryOptions() { return []; }
export async function getInventoryReport(): Promise<never> { throw new Error('Inventory disabled in this synthetic preview'); }
