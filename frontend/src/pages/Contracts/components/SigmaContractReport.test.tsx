import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import type { SigmaReport } from '../../../types/SigmaReport';
import SigmaContractReport from './SigmaContractReport';

const state = vi.hoisted(() => ({ role: 'admin' as string | null, facility: 'facility-a' as string | null, get: vi.fn() }));
vi.mock('../../../context/UserContext', () => ({ useUser: () => ({ user: state.role ? { role: state.role } : null }) }));
vi.mock('../../../context/FacilityContext', () => ({ useFacility: () => ({ selectedFacilityId: state.facility, availableFacilities: [{ _id: 'facility-a', name: 'Synthetic Hospital' }] }) }));
vi.mock('../../../services/contractAPI', () => ({ getSigmaContractReport: state.get }));

function report(): SigmaReport {
  const cost = { knownSubtotal: 50, total: null, isComplete: false, missingComponents: [{ reason: 'labor_unknown' }], fullyPricedCount: 0, workOrderCount: 1 };
  return {
    schemaVersion: 'sigma-contract-report-v1', generatedAt: '2026-11-15T12:00:00.000Z',
    contract: { id: 'contract-a', facilityId: 'facility-a', name: 'Synthetic Contract', number: 'TEST-1', status: 'active' },
    period: { startDate: '2026-10-01', endDate: '2026-10-31', timeZone: 'UTC', effectiveStart: null, effectiveEndExclusive: null },
    contractValue: 310, costs: { scopes: { directMaintenance: cost, vendorDirect: cost }, components: { internalLabor: cost, internalTravel: cost, internalParts: cost } },
    activity: { total: 1, closed: 1, open: 0, preventive: 1, laborHours: 2, travelHours: 0.5 },
    contribution: null, marginPercent: null, warnings: ['Current whole-Work-Order totals; not period expenses.'],
    workOrders: [{ id: 'workorder-a', number: 'WO-TEST', assetId: 'asset-a', requestDate: '2026-10-15T12:00:00.000Z', type: 'PM', status: 'Completed', laborHours: 2, travelHours: 0.5, cost }],
  };
}
const panel = (contractId = 'contract-a') => <MemoryRouter><SigmaContractReport contractId={contractId} contractType="customer" /></MemoryRouter>;
function dates() {
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('End date (inclusive)'), { target: { value: '2026-10-31' } });
}
beforeEach(() => { state.role = 'admin'; state.facility = 'facility-a'; state.get.mockReset(); state.get.mockResolvedValue(report()); });

test.each(['technician', 'customer', 'viewer', null])('role %s cannot see or request internal report', role => {
  state.role = role;
  render(panel());
  expect(screen.queryByRole('button', { name: 'Generate report' })).not.toBeInTheDocument();
  expect(state.get).not.toHaveBeenCalled();
});
test('missing Facility prevents report generation', () => {
  state.facility = null; render(panel());
  expect(screen.getByRole('button', { name: 'Generate report' })).toBeDisabled();
  expect(state.get).not.toHaveBeenCalled();
});
test('selected dates and Facility are requested; partial costs and Work Order link remain explicit', async () => {
  render(panel()); dates();
  fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
  await screen.findByRole('button', { name: 'Download CSV for Excel' });
  expect(state.get).toHaveBeenCalledWith('contract-a', '2026-10-01', '2026-10-31', 'facility-a');
  expect(screen.getByText('Synthetic Hospital', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('Current whole-Work-Order totals; not period expenses.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'WO-TEST' })).toHaveAttribute('href', '/workorders/edit/workorder-a');
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(1);
  fireEvent.change(screen.getByLabelText('End date (inclusive)'), { target: { value: '2026-11-01' } });
  expect(screen.queryByRole('button', { name: 'Download CSV for Excel' })).not.toBeInTheDocument();
});
test('upstream failure displays an error and offers no download', async () => {
  state.get.mockRejectedValue({ response: { data: { error: 'Report unavailable' } } });
  render(panel()); dates(); fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Report unavailable');
  expect(screen.queryByRole('button', { name: 'Download CSV for Excel' })).not.toBeInTheDocument();
});
test('late response after Facility switch cannot display or export the previous report', async () => {
  let resolve!: (value: SigmaReport) => void;
  state.get.mockReturnValue(new Promise<SigmaReport>(done => { resolve = done; }));
  const view = render(panel()); dates(); fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
  state.facility = 'facility-b'; view.rerender(panel());
  await act(async () => resolve(report()));
  expect(screen.queryByRole('link', { name: 'WO-TEST' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Download CSV for Excel' })).not.toBeInTheDocument();
});
test('Contract switch clears a completed report', async () => {
  const view = render(panel()); dates(); fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
  await screen.findByRole('button', { name: 'Download CSV for Excel' });
  view.rerender(panel('contract-b'));
  await waitFor(() => expect(screen.queryByRole('link', { name: 'WO-TEST' })).not.toBeInTheDocument());
});
