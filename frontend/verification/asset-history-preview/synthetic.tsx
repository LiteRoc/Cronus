import { createContext, useContext } from 'react';
import type { AssetHistoryReport, HistoryCost, HistoryFilters, HistoryRow } from '../../src/types/AssetHistoryReport';
export const hospitalA = '000000000000000000000001', hospitalB = '000000000000000000000002';
export const previewAssetId = '000000000000000000000010';
export type Scenario = 'sample' | 'pages' | 'empty' | 'unavailable';
export const settings: { scenario: Scenario } = { scenario: 'sample' };
export const PreviewContext = createContext({ role: 'admin', facilityId: hospitalA as string | null });
export const useUser = () => ({ user: { _id: 'synthetic-history-user', role: useContext(PreviewContext).role } });
export const useFacility = () => ({ selectedFacilityId: useContext(PreviewContext).facilityId });
function failure(message: string): never { throw Object.assign(new Error(message), { response: { data: { error: message } } }); }
const cost = (amount: number, partial = false): HistoryCost => ({ knownSubtotal: amount, total: partial ? null : amount, isComplete: !partial, missingComponents: partial ? [{ reason: 'travel_policy_unapproved' }] : [] });
const combine = (values: HistoryCost[]): HistoryCost => ({ knownSubtotal: values.reduce((sum, value) => sum + value.knownSubtotal, 0), total: values.every(value => value.isComplete) ? values.reduce((sum, value) => sum + value.knownSubtotal, 0) : null,
  isComplete: values.every(value => value.isComplete), missingComponents: values.flatMap(value => value.missingComponents) });
function workOrder(index: number, partial = false): HistoryRow {
  const labor = partial ? 50 : 100;
  return { id: String(index + 100).padStart(24, '0'), number: 9000 + index, requested: partial ? '2026-02-28T12:00:00.000Z' : '2026-02-01T12:00:00.000Z', completed: '2026-03-02T12:00:00.000Z',
    type: partial ? 'Corrective Maintenance' : 'Preventive Maintenance', status: partial ? 'Archived' : 'Completed', description: partial ? 'Synthetic intermittent fault investigation' : 'Synthetic preventive inspection',
    labor: { recorded: partial ? 1 : 2, invalidEntries: 0 }, travel: { recorded: partial ? 0.5 : 0, invalidEntries: 0 },
    serviceNotes: [{ workDate: partial ? '2026-02-28' : '2026-02-01', description: partial ? 'Synthetic service note: inspected connections and verified operation.' : 'Synthetic service note: completed recorded inspection.' }],
    parts: partial ? [{ id: '000000000000000000000999', number: '', description: '', referenceState: 'unavailable', quantity: 1, note: 'Legacy reference has no catalog label.' }] : [],
    vendor: partial ? { name: 'Synthetic Vendor', workOrderNumber: 'SYN-V-1', laborHours: 4, travelHours: null } : null,
    scopes: { internal: cost(labor, partial), vendorDirect: cost(0), directMaintenance: cost(labor, partial) },
    components: { internalLabor: cost(labor), internalTravel: cost(0, partial), internalParts: cost(0) }, costState: 'stale' };
}
export async function getAssetHistoryReport(facilityId: string, filters: HistoryFilters): Promise<AssetHistoryReport> {
  if (settings.scenario === 'unavailable') failure('Synthetic history report unavailable.');
  if (facilityId !== hospitalA || filters.assetId && filters.assetId.toLowerCase() !== previewAssetId || filters.controlNumber && filters.controlNumber !== 'SYN-HIST-001') failure('Synthetic asset not found in selected hospital.');
  let rows = settings.scenario === 'empty' ? [] : settings.scenario === 'pages' ? Array.from({ length: 30 }, (_, index) => ({ ...workOrder(index + 1), requested: new Date(Date.UTC(2026, 1, index + 1, 12)).toISOString() })) : [workOrder(2, true), workOrder(1)];
  if (filters.startDate || filters.endDate) {
    if (!filters.startDate || !filters.endDate) failure('Supply both dates.');
    const start = +new Date(`${filters.startDate}T00:00:00Z`), end = +new Date(`${filters.endDate}T00:00:00Z`) + 86400000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) failure('Invalid date range.');
    rows = rows.filter(row => row.requested && +new Date(row.requested) >= start && +new Date(row.requested) < end);
  }
  rows.sort((a, b) => String(b.requested).localeCompare(String(a.requested)) || b.id.localeCompare(a.id));
  return { schemaVersion: 'asset-history-v1', generatedAt: new Date().toISOString(), filters: { ...filters }, facility: { id: hospitalA, name: 'Synthetic Hospital A' },
    asset: { id: previewAssetId, ctrlNumber: 'SYN-HIST-001', manufacturer: 'Synthetic Medical', model: 'Pump', description: 'Invented equipment for browser verification', serialNumber: 'SYN-SERIAL-HISTORY', equipmentClass: 'Pump', status: 'Active', isArchived: false, location: 'Room 1', department: 'Synthetic Imaging', departmentState: 'resolved',
      acquisitionDate: '2020-01-01T00:00:00.000Z', installationDate: null, serviceStartDate: '2020-02-01T00:00:00.000Z', retirementDate: null, pmFrequency: 'Yearly', lastPM: '2026-02-01T00:00:00.000Z', nextPM: '2027-02-01T00:00:00.000Z' },
    summary: { workOrderCount: rows.length, archivedCount: rows.filter(row => row.status === 'Archived').length, missingRequestDates: 0, laborHours: rows.reduce((sum, row) => sum + row.labor.recorded, 0), travelHours: rows.reduce((sum, row) => sum + row.travel.recorded, 0),
      invalidTimeEntries: 0, fullyPricedCount: rows.filter(row => row.scopes.directMaintenance.isComplete).length,
      scopes: Object.fromEntries(['internal', 'vendorDirect', 'directMaintenance'].map(name => [name, combine(rows.map(row => row.scopes[name]))])),
      components: Object.fromEntries(['internalLabor', 'internalTravel', 'internalParts'].map(name => [name, combine(rows.map(row => row.components[name]))])) },
    rows, notes: ['SYNTHETIC PREVIEW ONLY. All records, identities, amounts and hours are invented. These fixtures do not validate backend calculations.',
      'Current recorded history, newest request date first. Archived Work Orders are included. Dates are filtered by request date, not completion date.',
      'Costs/hours are whole-Work-Order totals, not period expenses. Vendor-reported hours are separate from internal hours. Missing catalog labels and costs remain explicit.',
      'PM schedule fields are not certification of maintenance completion. No live API, sign-in, browser storage, database or scheduler is used.'] };
}
// ReportsRoute imports the inventory page as its normal fallback. Keep its
// otherwise-unused transport synthetic too; no live client may enter this bundle.
export async function getInventoryOptions() { return []; }
export async function getInventoryReport(): Promise<never> { return failure('Inventory is outside this history preview.'); }
