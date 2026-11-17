import { createContext, useContext } from 'react';
import { fixture as monthFixture } from '../month-end-preview/synthetic';
import type { YearEndFilters, YearEndReport } from '../../src/types/YearEndReport';
export const hospitalA = '000000000000000000000001', hospitalB = '000000000000000000000002';
export type Scenario = 'sample' | 'pages' | 'empty' | 'unavailable';
export const settings: { scenario: Scenario } = { scenario: 'sample' };
export const PreviewContext = createContext({ role: 'admin', facilityId: hospitalA as string | null });
export const useUser = () => ({ user: { _id: 'synthetic-year-user', role: useContext(PreviewContext).role } });
export const useFacility = () => ({ selectedFacilityId: useContext(PreviewContext).facilityId });
export function fixture(filters: YearEndFilters = { yearEnding: '2025', startMonth: '1', includeArchived: 'false' }, count = 12): YearEndReport {
  const year = Number(filters.yearEnding), month = Number(filters.startMonth), start = new Date(Date.UTC(month === 1 ? year : year - 1, month - 1, 1)), end = new Date(start); end.setUTCFullYear(end.getUTCFullYear() + 1);
  const generatedAt = '2026-11-17T12:00:00.000Z', source = monthFixture({ month: start.toISOString().slice(0, 7), includeArchived: filters.includeArchived }, count);
  const rows = source.activity.rows.map((r, i) => { const date = new Date(start); date.setUTCMonth(date.getUTCMonth() + i % 12); date.setUTCDate(15); return { ...r, completed: date.toISOString() }; }).filter(r => r.completed < generatedAt);
  const summarize = (selected: typeof rows) => ({ ...source.activity.summary, count: selected.length, archived: selected.filter(r => r.status === 'Archived').length, laborHours: selected.length * 2, travelHours: selected.length * 0.5, vendorKnownLaborHours: selected.reduce((s, r) => s + (r.vendorLaborHours || 0), 0), vendorMissingTravelHours: selected.filter(r => r.vendorLaborHours !== null && r.vendorTravelHours === null).length,
    cost: { knownSubtotal: selected.length * 100, total: selected.every(r => r.cost.isComplete) ? selected.length * 100 : null, isComplete: selected.every(r => r.cost.isComplete), missingComponents: selected.flatMap(r => r.cost.missingComponents) } });
  const months = Array.from({ length: 12 }, (_, i) => { const date = new Date(start); date.setUTCMonth(date.getUTCMonth() + i); const next = new Date(date); next.setUTCMonth(next.getUTCMonth() + 1); const key = date.toISOString().slice(0, 7); return { month: key, state: (date.toISOString() > generatedAt ? 'future' : next.toISOString() > generatedAt ? 'in_progress' : 'complete') as 'future' | 'in_progress' | 'complete', summary: summarize(rows.filter(r => r.completed.startsWith(key))) }; });
  const types = new Map<string, number>(); rows.forEach(r => types.set(r.type, (types.get(r.type) || 0) + 1));
  return { schemaVersion: 'year-end-v1', generatedAt, facility: source.facility, filters, period: { yearEnding: filters.yearEnding, startMonth: filters.startMonth, start: start.toISOString(), endExclusive: end.toISOString(), isInProgress: generatedAt < end.toISOString() },
    activity: { summary: summarize(rows), rows }, backlog: { ...source.backlog, generatedAt }, backlogBreakdown: source.backlogBreakdown, months,
    charts: { completedByType: [...types].map(([label, count]) => ({ label, count })), backlogByPriority: source.charts.backlogByPriority, monthlyCompletions: months.map(m => ({ month: m.month, count: m.state === 'future' ? null : m.summary.count })) },
    notes: ['Synthetic reporting year labeled by ending year. Calendar January–December or selected fiscal start. All boundaries UTC.', 'Whole-WO hours and costs by completion cohort, not period labor or expenses. Current backlog remains separate, never historical year-end backlog.', 'Unknown costs remain unknown. Future months unobserved. No compliance or margin certification. PDF summary includes charts; CSV includes all captured detail.'] };
}
export async function getYearEndReport(facilityId: string, filters: YearEndFilters): Promise<YearEndReport> {
  if (settings.scenario === 'unavailable') throw Object.assign(new Error(), { response: { data: { error: 'Synthetic report unavailable. No live request was sent.' } } });
  const report = fixture(filters, settings.scenario === 'empty' || facilityId === hospitalB ? 0 : settings.scenario === 'pages' ? 55 : 12);
  report.facility = { id: facilityId, name: facilityId === hospitalA ? 'Synthetic Hospital A' : 'Synthetic Hospital B' }; report.backlog.facility = report.facility; return report;
}
export async function getInventoryOptions() { return []; }
export async function getInventoryReport(): Promise<never> { throw new Error('Inventory disabled in this synthetic preview'); }
