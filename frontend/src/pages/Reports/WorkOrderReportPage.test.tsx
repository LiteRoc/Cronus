import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import WorkOrderReportPage from './WorkOrderReportPage';
import ReportsRoute from './ReportsRoute';
import type { WorkOrderReport } from '../../types/WorkOrderReport';
import { workOrderReportCsv } from '../../utils/workOrderReportCsv';
const state = vi.hoisted(() => ({ facility: 'facility-a' as string | null, role: 'admin', get: vi.fn() }));
vi.mock('../../context/UserContext', () => ({ useUser: () => ({ user: { _id: 'user-a', role: state.role } }) }));
vi.mock('../../context/FacilityContext', () => ({ useFacility: () => ({ selectedFacilityId: state.facility }) }));
vi.mock('../../services/workOrderReportAPI', () => ({ getWorkOrderReport: state.get }));
function fixture(count = 1): WorkOrderReport {
  const cost = { knownSubtotal: 100, total: null, isComplete: false, missingComponents: [{ reason: 'missing_evidence' }] };
  return { schemaVersion: 'work-order-report-v1', generatedAt: '2026-11-16T12:00:00Z', facility: { id: 'facility-a', name: 'Synthetic Hospital' }, filters: { mode: 'open' },
    summary: { count, overdue: 1, missingDueDates: 0, missingRequestDates: 0, unavailableAssets: 0, archived: 0, cost }, notes: ['Current recorded status'],
    rows: Array.from({ length: count }, (_, i) => ({ id: `wo-${i}`, number: i + 1, status: 'Open', priority: 'Normal', type: 'CM', description: '=FORMULA,"quoted"', asset: null,
      requested: '2026-11-15T12:00:00Z', scheduled: null, due: null, completed: null, ageDays: 1, overdue: null, cost })) };
}
const page = () => <MemoryRouter><ReportsRoute content={<WorkOrderReportPage />} /></MemoryRouter>;
const generate = () => fireEvent.click(screen.getByRole('button', { name: 'Generate Work Order report' }));
beforeEach(() => { vi.clearAllMocks(); state.facility = 'facility-a'; state.role = 'admin'; state.get.mockResolvedValue(fixture()); });
test('open report renders links, unknown totals and hides captured export on filter changes', async () => {
  render(page()); generate(); await screen.findByRole('button', { name: 'Download Work Order CSV' });
  expect(state.get).toHaveBeenCalledWith('facility-a', { mode: 'open' }); expect(screen.getByText('Work Order 1')).toHaveAttribute('href', '/workorders/edit/wo-0');
  expect(screen.getByText('Asset reference unavailable')).toBeInTheDocument(); expect(screen.getAllByText(/Unavailable/).length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'High' } }); expect(screen.queryByRole('button', { name: 'Download Work Order CSV' })).not.toBeInTheDocument();
});
test('closed dates and archive option are explicit, mode change removes incompatible filters', async () => {
  render(page()); fireEvent.change(screen.getByLabelText('Report'), { target: { value: 'closed' } });
  fireEvent.change(screen.getByLabelText('Completion start (UTC)'), { target: { value: '2026-02-01' } }); fireEvent.change(screen.getByLabelText('Completion end (UTC, inclusive)'), { target: { value: '2026-02-28' } });
  fireEvent.change(screen.getByLabelText('Archived records'), { target: { value: 'true' } }); generate();
  await screen.findByRole('button', { name: 'Download Work Order CSV' }); expect(state.get).toHaveBeenLastCalledWith('facility-a', { mode: 'closed', startDate: '2026-02-01', endDate: '2026-02-28', includeArchived: 'true' });
  fireEvent.change(screen.getByLabelText('Report'), { target: { value: 'open' } }); generate(); await screen.findByRole('button', { name: 'Download Work Order CSV' }); expect(state.get).toHaveBeenLastCalledWith('facility-a', { mode: 'open' });
});
test('late hospital response stays hidden', async () => {
  let resolve!: (v: WorkOrderReport) => void; state.get.mockReturnValue(new Promise(r => { resolve = r; }));
  const view = render(page()); generate(); state.facility = 'facility-b'; view.rerender(page());
  await act(async () => resolve(fixture())); expect(screen.queryByText('Synthetic Hospital')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Download Work Order CSV' })).not.toBeInTheDocument();
});
test('empty, error, missing hospital and role gate', async () => {
  state.get.mockResolvedValue(fixture(0)); const view = render(page()); generate(); await screen.findByText('No Work Orders match these filters.');
  state.get.mockRejectedValue({ response: { data: { error: 'Synthetic unavailable' } } }); generate(); await screen.findByRole('alert'); expect(screen.queryByRole('button', { name: 'Download Work Order CSV' })).not.toBeInTheDocument();
  state.facility = null; view.rerender(page()); expect(screen.getByRole('button', { name: 'Generate Work Order report' })).toBeDisabled();
  state.role = 'viewer'; view.rerender(page()); expect(screen.queryByText('Work Order Reports')).not.toBeInTheDocument();
});
test('pagination shows 50 rows but CSV contains all captured rows with formula safety and blank unknown totals', async () => {
  const report = fixture(51); state.get.mockResolvedValue(report); render(page()); generate(); await screen.findByRole('button', { name: 'Next' });
  expect(screen.queryByText('Work Order 51')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Next' })); expect(screen.getByText('Work Order 51')).toBeInTheDocument();
  const csv = workOrderReportCsv(report); expect(csv.charCodeAt(0)).toBe(0xFEFF); expect(csv).toContain('"wo-50"'); expect(csv).toContain('"\'=FORMULA,""quoted"""'); expect(csv).toContain('"Complete direct cost total",""');
});
test('PM route initializes PM mode, hides type override, sends due selection and clears incompatible range', async () => {
  render(<MemoryRouter><ReportsRoute content={<WorkOrderReportPage initialMode="pm" />} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Open PM Report' })).toBeInTheDocument(); expect(screen.queryByLabelText('Work Order type')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('PM due selection'), { target: { value: 'range' } });
  fireEvent.change(screen.getByLabelText('PM due start (UTC)'), { target: { value: '2026-02-01' } }); fireEvent.change(screen.getByLabelText('PM due end (UTC, inclusive)'), { target: { value: '2026-02-28' } }); generate();
  await screen.findByRole('button', { name: 'Download Work Order CSV' }); expect(state.get).toHaveBeenLastCalledWith('facility-a', { mode: 'pm', dueStatus: 'range', startDate: '2026-02-01', endDate: '2026-02-28' });
  fireEvent.change(screen.getByLabelText('PM due selection'), { target: { value: 'missing' } }); expect(screen.queryByRole('button', { name: 'Download Work Order CSV' })).not.toBeInTheDocument(); generate();
  await screen.findByRole('button', { name: 'Download Work Order CSV' }); expect(state.get).toHaveBeenLastCalledWith('facility-a', { mode: 'pm', dueStatus: 'missing' });
});
test('PM selection survives hospital reset without retaining report or due filters', async () => {
  const content = () => <MemoryRouter><WorkOrderReportPage initialMode="pm" /></MemoryRouter>;
  const view = render(content()); fireEvent.change(screen.getByLabelText('PM due selection'), { target: { value: 'overdue' } });
  state.facility = 'facility-b'; view.rerender(content()); expect(screen.getByLabelText('Report')).toHaveValue('pm'); expect(screen.getByLabelText('PM due selection')).toHaveValue('all');
});
