import { createContext, useContext } from 'react';
import type { ReportCost, SigmaReport } from '../../src/types/SigmaReport';

export const contractId = '000000000000000000000001';
export const hospitalA = '000000000000000000000002';
export const hospitalB = '000000000000000000000003';
export type Scenario = 'partial' | 'complete' | 'empty' | 'unavailable';
export const previewSettings: { scenario: Scenario } = { scenario: 'partial' };
export const PreviewContext = createContext({ role: 'admin', facilityId: hospitalA as string | null });
export const useUser = () => ({ user: { role: useContext(PreviewContext).role } });
export const useFacility = () => ({
  selectedFacilityId: useContext(PreviewContext).facilityId,
  availableFacilities: [{ _id: hospitalA, name: 'Synthetic Hospital A' }, { _id: hospitalB, name: 'Synthetic Hospital B' }],
});
function cost(amount: number, incomplete: boolean, count: number): ReportCost {
  return { knownSubtotal: amount, total: incomplete ? null : amount, isComplete: !incomplete,
    missingComponents: incomplete ? [{ reason: 'travel_policy_unapproved' }] : [],
    workOrderCount: count, fullyPricedCount: incomplete ? 1 : count };
}

// This replaces only the preview's transport import. It never makes a request,
// reads browser storage, loads a token, or opens a database connection.
export async function getSigmaContractReport(id: string, startDate: string, endDate: string, facilityId: string): Promise<SigmaReport> {
  const scenario = previewSettings.scenario;
  if (scenario === 'unavailable') throw new Error('Synthetic unavailable response');
  const start = new Date(`${startDate}T00:00:00Z`), end = new Date(`${endDate}T00:00:00Z`);
  const days = (+end - +start) / 86400000 + 1;
  if (!Number.isFinite(days) || days < 1) throw new Error('Invalid preview dates');
  const empty = scenario === 'empty', partial = scenario === 'partial';
  const count = empty ? 0 : 2;
  const labor = cost(empty ? 0 : 100, false, count);
  const travel = cost(empty || partial ? 0 : 20, partial, count);
  const parts = cost(empty ? 0 : 25, false, count);
  const vendor = cost(empty ? 0 : 25, false, count);
  const internal = cost(empty ? 0 : partial ? 125 : 145, partial, count);
  const direct = cost(empty ? 0 : partial ? 150 : 170, partial, count);
  return {
    schemaVersion: 'sigma-contract-report-v1', generatedAt: new Date().toISOString(),
    contract: { id, name: 'Synthetic CAM Contract', number: 'SYNTHETIC-ONLY-001', facilityId, status: 'active' },
    period: { startDate, endDate, timeZone: 'UTC', effectiveStart: start.toISOString(), effectiveEndExclusive: new Date(+end + 86400000).toISOString() },
    contractValue: days * 10,
    costs: { scopes: { internal, vendorDirect: vendor, directMaintenance: direct }, components: { internalLabor: labor, internalTravel: travel, internalParts: parts } },
    activity: { total: count, closed: empty ? 0 : 1, open: empty ? 0 : 1, preventive: empty ? 0 : 1, laborHours: empty ? 0 : 2, travelHours: empty ? 0 : 0.5 },
    contribution: null, marginPercent: null,
    warnings: [
      'SYNTHETIC PREVIEW ONLY. All names, identifiers, rates, costs and service records are invented.',
      'Preview contract value is 10 per selected UTC day. This fixture does not validate backend calculations.',
      'Current whole-work-order totals are shown for the selected request-date cohort, not period expenses.',
      'Contribution and margin are unavailable. No operational labor rate or vendor payout attribution is established.',
    ],
    workOrders: empty ? [] : [
      { id: '000000000000000000000010', number: 'SYNTHETIC-WO-1', assetId: '000000000000000000000020', requestDate: start.toISOString(),
        type: 'Preventive Maintenance', status: 'Completed', laborHours: 2, travelHours: 0.5, cost: { ...direct, workOrderCount: 1, fullyPricedCount: partial ? 0 : 1 } },
      { id: '000000000000000000000011', number: 'SYNTHETIC-WO-2', assetId: '000000000000000000000021', requestDate: end.toISOString(),
        type: 'Corrective Maintenance', status: 'Open', laborHours: 0, travelHours: 0, cost: cost(0, false, 1) },
    ],
  };
}
