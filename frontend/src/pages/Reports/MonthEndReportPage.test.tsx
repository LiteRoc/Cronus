import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import MonthEndReportPage from './MonthEndReportPage';
import ReportsRoute from './ReportsRoute';
import { fixture } from '../../../verification/month-end-preview/synthetic';
import { monthEndReportCsv } from '../../utils/monthEndReportCsv';
import type { MonthEndReport } from '../../types/MonthEndReport';
const state = vi.hoisted(() => ({ facility: 'facility-a' as string | null, role: 'admin', get: vi.fn(), save: vi.fn(), build: vi.fn() }));
vi.mock('../../context/UserContext', () => ({ useUser: () => ({ user: { _id: 'a', role: state.role } }) }));
vi.mock('../../context/FacilityContext', () => ({ useFacility: () => ({ selectedFacilityId: state.facility }) }));
vi.mock('../../services/monthEndReportAPI', () => ({ getMonthEndReport: state.get }));
vi.mock('../../utils/operationsReportPdf', () => ({ buildOperationsReportPdf: state.build }));
vi.mock('recharts', () => ({ ResponsiveContainer: () => null, BarChart: () => null, Bar: () => null, Cell: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, LineChart: () => null, Line: () => null }));
const page = () => <MemoryRouter><ReportsRoute content={<MonthEndReportPage />} /></MemoryRouter>;
function generate() { fireEvent.change(screen.getByLabelText('Month (UTC)'), { target: { value: '2026-10' } }); fireEvent.click(screen.getByRole('button', { name: 'Generate month-end report' })); }
beforeEach(() => { vi.clearAllMocks(); state.facility = 'facility-a'; state.role = 'admin'; state.get.mockResolvedValue(fixture()); state.build.mockReturnValue({ save: state.save }); });
test('chart counts accessible with clearly separate cohorts and export invalidated on month changes', async () => {
  render(page()); generate(); await screen.findByRole('button', { name: 'Download month-end CSV' }); expect(state.get).toHaveBeenCalledWith('facility-a', { month: '2026-10', includeArchived: 'false' });
  expect(screen.getByRole('region', { name: 'Completed activity by Work Order type' })).toBeInTheDocument(); expect(screen.getByRole('region', { name: 'Current backlog by priority — at generation' })).toBeInTheDocument(); expect(screen.getByRole('region', { name: 'Completion activity across the month' })).toBeInTheDocument();
  expect(screen.getByText('Current backlog at generation — not month-end backlog')).toBeInTheDocument(); fireEvent.change(screen.getByLabelText('Month (UTC)'), { target: { value: '2026-09' } }); expect(screen.queryByRole('button', { name: 'Download month-end CSV' })).not.toBeInTheDocument();
});
test('late response from prior hospital remains hidden', async () => { let resolve!: (r: MonthEndReport) => void; state.get.mockReturnValue(new Promise(r => { resolve = r; })); const view = render(page()); generate(); state.facility = 'b'; view.rerender(page()); await act(async () => resolve(fixture())); expect(screen.queryByText('Synthetic Hospital A')).not.toBeInTheDocument(); });
test('current month marked provisional and empty activity explained', async () => { state.get.mockResolvedValue(fixture({ month: '2026-11', includeArchived: 'false' }, 0)); render(page()); generate(); await screen.findByText('Month in progress — this is a provisional report.'); expect(screen.getByText('No completion activity for this selection.')).toBeInTheDocument(); });
test('unavailable report hides export; missing facility and denied role cannot request', async () => { state.get.mockRejectedValue(new Error()); const view = render(page()); generate(); await screen.findByRole('alert'); expect(screen.queryByRole('button', { name: 'Download month-end CSV' })).not.toBeInTheDocument(); state.facility = null; view.rerender(page()); expect(screen.getByRole('button', { name: 'Generate month-end report' })).toBeDisabled(); state.role = 'viewer'; view.rerender(page()); expect(screen.queryByRole('heading', { name: 'Month-end Operations' })).not.toBeInTheDocument(); });
test('pagination and CSV include all completions, chart counts and a separate backlog section', async () => {
  const r = fixture(undefined, 55); r.activity.rows[0].type = '=DANGEROUS'; state.get.mockResolvedValue(r); render(page()); generate(); await screen.findByRole('button', { name: 'Next' }); expect(screen.queryByText('Work Order 9355')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Next' })); expect(screen.getByText('Work Order 9355')).toBeInTheDocument();
  const csv = monthEndReportCsv(r); expect(csv).toContain('"9355"'); expect(csv).toContain('"\'=DANGEROUS"'); expect(csv).toContain('"Complete direct cost total",""'); expect(csv).toContain('CURRENT BACKLOG AT GENERATION'); expect(csv).toContain('"Completion date (UTC)","Count"');
});
test('current PM/corrective/other backlog categories appear separately in chart, cards and CSV', async () => {
  const r = fixture(); state.get.mockResolvedValue(r); render(page()); generate(); await screen.findByRole('button', { name: 'Download month-end CSV' });
  expect(screen.getByRole('region', { name: 'Current backlog by work category - at generation' })).toBeInTheDocument();
  for (const label of ['Open PM', 'Open corrective', 'Other open work']) expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
  const csv = monthEndReportCsv(r); expect(csv).toContain('"Open PM","1","1","0"'); expect(csv).toContain('"Open corrective","1","0","1"'); expect(csv).toContain('"Other open work","0","0","0"');
});
test('month-end PDF saves captured summary without fetching new data and hides after filter changes', async () => {
  render(page()); generate(); await screen.findByRole('button', { name: 'Download month-end PDF' }); fireEvent.click(screen.getByRole('button', { name: 'Download month-end PDF' })); await vi.waitFor(() => expect(state.save).toHaveBeenCalled());
  expect(state.get).toHaveBeenCalledTimes(1); expect(state.build).toHaveBeenCalledWith(fixture()); fireEvent.change(screen.getByLabelText('Month (UTC)'), { target: { value: '2026-09' } }); expect(screen.queryByRole('button', { name: 'Download month-end PDF' })).not.toBeInTheDocument();
});
