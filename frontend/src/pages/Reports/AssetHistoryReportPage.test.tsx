import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import AssetHistoryReportPage from './AssetHistoryReportPage';
import ReportsRoute from './ReportsRoute';
import type { AssetHistoryReport } from '../../types/AssetHistoryReport';
import { assetHistoryReportCsv } from '../../utils/assetHistoryReportCsv';
const state = vi.hoisted(() => ({ role: 'admin', facility: 'facility-a' as string | null, get: vi.fn() }));
vi.mock('../../context/UserContext', () => ({ useUser: () => ({ user: { _id: 'user-a', role: state.role } }) }));
vi.mock('../../context/FacilityContext', () => ({ useFacility: () => ({ selectedFacilityId: state.facility }) }));
vi.mock('../../services/assetHistoryReportAPI', () => ({ getAssetHistoryReport: state.get }));
function fixture(): AssetHistoryReport {
  const scope = { knownSubtotal: 100, total: null, isComplete: false, missingComponents: [{ reason: 'travel_policy_unapproved' }] };
  return { schemaVersion: 'asset-history-v1', generatedAt: '2026-11-16T12:00:00.000Z', facility: { id: 'facility-a', name: 'Synthetic Hospital' }, filters: { controlNumber: 'SYN-1' },
    asset: { id: 'asset-a', ctrlNumber: 'SYN-1', manufacturer: 'Synthetic', model: 'Pump', description: 'Synthetic equipment', serialNumber: '', equipmentClass: 'Pump', status: 'Active', isArchived: false, location: 'Room 1', department: '', departmentState: 'unassigned',
      acquisitionDate: null, installationDate: null, serviceStartDate: null, retirementDate: null, pmFrequency: 'Yearly', lastPM: null, nextPM: null },
    summary: { workOrderCount: 1, archivedCount: 1, missingRequestDates: 0, laborHours: 2, travelHours: 0.5, invalidTimeEntries: 0, fullyPricedCount: 0,
      scopes: { internal: scope, vendorDirect: scope, directMaintenance: scope }, components: { internalLabor: scope, internalTravel: scope, internalParts: scope } },
    rows: [{ id: 'work-order-a', number: 1, requested: '2026-02-15T00:00:00.000Z', completed: null, type: 'PM', status: 'Archived', description: 'Recorded service request',
      labor: { recorded: 2, invalidEntries: 0 }, travel: { recorded: 0.5, invalidEntries: 0 }, serviceNotes: [{ workDate: '2026-02-15', description: 'Synthetic repair note' }],
      parts: [{ id: 'part-a', number: '', description: '', referenceState: 'unavailable', quantity: 1, note: 'Recorded note' }], vendor: null,
      scopes: { internal: scope, vendorDirect: scope, directMaintenance: scope }, components: { internalLabor: scope, internalTravel: scope, internalParts: scope }, costState: 'stale' }], notes: ['Current recorded history, not a historical snapshot'] };
}
const page = (url = '/reports/asset-history') => <MemoryRouter initialEntries={[url]}><ReportsRoute content={<AssetHistoryReportPage />} /></MemoryRouter>;
const generate = () => { fireEvent.change(screen.getByLabelText('Control number'), { target: { value: 'SYN-1' } }); fireEvent.click(screen.getByRole('button', { name: 'Generate asset history' })); };
beforeEach(() => { state.role = 'admin'; state.facility = 'facility-a'; state.get.mockReset().mockResolvedValue(fixture()); });
test.each(['customer', 'viewer', 'tech'])('%s cannot see history report or request data', role => { state.role = role; render(page()); expect(screen.queryByRole('button', { name: 'Generate asset history' })).not.toBeInTheDocument(); expect(state.get).not.toHaveBeenCalled(); });
test('selected hospital is mandatory', () => { state.facility = null; render(page()); expect(screen.getByRole('button', { name: 'Generate asset history' })).toBeDisabled(); });
test('technician can generate an exact control-number report with explicit partial costs', async () => {
  state.role = 'technician'; render(page()); generate(); await screen.findByRole('button', { name: 'Download history CSV' });
  expect(state.get).toHaveBeenCalledWith('facility-a', { controlNumber: 'SYN-1' });
  expect(screen.getByText('Recorded service request')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Work Order 1' })).toHaveAttribute('href', '/workorders/edit/work-order-a');
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Control number'), { target: { value: 'OTHER' } });
  expect(screen.queryByRole('button', { name: 'Download history CSV' })).not.toBeInTheDocument();
});
test('inventory deep link prefills Asset ID and date filter changes hide captured report', async () => {
  render(page('/reports/asset-history?assetId=asset-a')); expect(screen.getByLabelText('Asset ID')).toHaveValue('asset-a');
  fireEvent.click(screen.getByRole('button', { name: 'Generate asset history' })); await screen.findByRole('button', { name: 'Download history CSV' });
  expect(state.get).toHaveBeenCalledWith('facility-a', { assetId: 'asset-a' });
  fireEvent.change(screen.getByLabelText('Request start date (optional)'), { target: { value: '2026-02-01' } });
  expect(screen.queryByRole('button', { name: 'Download history CSV' })).not.toBeInTheDocument();
});
test('late response from another hospital cannot be displayed or downloaded', async () => {
  let finish!: (value: AssetHistoryReport) => void; state.get.mockReturnValue(new Promise<AssetHistoryReport>(resolve => { finish = resolve; }));
  const view = render(page()); generate(); state.facility = 'facility-b'; view.rerender(page());
  await act(async () => finish(fixture())); expect(screen.queryByText('Recorded service request')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Download history CSV' })).not.toBeInTheDocument();
});
test('failed report offers no export', async () => { state.get.mockRejectedValue({ response: { data: { error: 'History too large' } } }); render(page()); generate(); expect(await screen.findByRole('alert')).toHaveTextContent('History too large'); expect(screen.queryByRole('button', { name: 'Download history CSV' })).not.toBeInTheDocument(); });
test('empty recorded history is explicit', async () => { const report = fixture(); report.rows = []; report.summary.workOrderCount = 0; state.get.mockResolvedValue(report); render(page()); generate(); expect(await screen.findByText('No recorded Work Orders match this asset and date range.')).toBeInTheDocument(); });
test('CSV retains notes, blank unknown costs, and all records beyond the first page', () => {
  const report = fixture(); report.asset.ctrlNumber = '\t=1'; report.rows[0].description = 'Line 1, "quoted"\nLine 2';
  report.rows = Array.from({ length: 26 }, (_, index) => ({ ...report.rows[0], id: `wo-${index + 1}`, number: index + 1 })); report.summary.workOrderCount = 26;
  const csv = assetHistoryReportCsv(report);
  expect(csv).toContain('"\'\t=1"'); expect(csv).toContain('"Line 1, ""quoted""\nLine 2"'); expect(csv).toContain('"directMaintenance","100","","false"');
  expect(csv).toContain('"26","wo-26"'); expect(csv).toContain('Synthetic repair note'); expect(csv).toContain('Recorded note');
});
