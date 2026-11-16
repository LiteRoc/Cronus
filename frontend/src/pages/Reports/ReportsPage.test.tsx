import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import ReportsPage from './ReportsPage';
import ReportsRoute, { canAccessReports } from './ReportsRoute';
import { useSidebarLinks } from '../../hooks/useSidebarLinks';
import type { AssetInventoryReport } from '../../types/AssetInventoryReport';
import { inventoryReportCsv } from '../../utils/inventoryReportCsv';
const state = vi.hoisted(() => ({ facility: 'facility-a' as string | null, role: 'admin', get: vi.fn() }));
vi.mock('../../context/FacilityContext', () => ({ useFacility: () => ({ selectedFacilityId: state.facility }) }));
vi.mock('../../context/UserContext', () => ({ useUser: () => ({ user: { _id: 'user-a', role: state.role } }) }));
vi.mock('../../services/inventoryReportAPI', () => ({ getInventoryReport: state.get, getInventoryOptions: async () => [{ id: 'dept-a', name: 'Imaging' }] }));
const fixture = (): AssetInventoryReport => ({ schemaVersion: 'asset-inventory-v1', generatedAt: '2026-11-16T12:00:00.000Z', facility: { id: 'facility-a', name: 'Synthetic A' }, filters: { archive: 'exclude' },
  rowCount: 1, departments: [{ id: 'dept-a', name: 'Imaging' }], dataQuality: { missingSerial: 1, missingNextPM: 1, unassignedDepartment: 0, unavailableDepartment: 0 }, notes: ['Current snapshot only'],
  rows: [{ id: 'asset-a', ctrlNumber: 'A-1', manufacturer: 'Synthetic', model: 'Pump', description: 'Test', serialNumber: '', equipmentClass: 'Pump', status: 'Active', isArchived: false, location: 'Room 1', department: 'Imaging', departmentState: 'resolved', pmFrequency: '', lastPM: null, nextPM: null }] });
const page = () => <MemoryRouter><ReportsPage /></MemoryRouter>;
beforeEach(() => { state.facility = 'facility-a'; state.role = 'admin'; state.get.mockReset().mockResolvedValue(fixture()); });
test.each(['admin', 'technician', 'customer', 'viewer', 'tech', 'unknown'])('Reports access and sidebar follow role %s', role => {
  expect(canAccessReports(role)).toBe(['admin', 'technician'].includes(role));
  if (['admin', 'technician', 'customer', 'viewer'].includes(role)) expect(useSidebarLinks(role as 'admin').some(link => link.to === '/reports')).toBe(canAccessReports(role));
  state.role = role;
  render(<MemoryRouter><ReportsRoute /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: 'Generate inventory' }) !== null).toBe(canAccessReports(role));
  expect(state.get).not.toHaveBeenCalled();
});
test('missing Facility disables generation', () => { state.facility = null; render(page()); expect(screen.getByRole('button', { name: 'Generate inventory' })).toBeDisabled(); });
test('preview uses scoped captured rows and hides old output on filter changes', async () => {
  render(page()); fireEvent.click(screen.getByRole('button', { name: 'Generate inventory' }));
  await screen.findByRole('button', { name: 'Download CSV for Excel' });
  expect(state.get).toHaveBeenCalledWith('facility-a', { archive: 'exclude' });
  expect(screen.getByRole('link', { name: 'A-1' })).toHaveAttribute('href', '/assets/edit/asset-a');
  fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'dept-a' } });
  expect(screen.queryByRole('button', { name: 'Download CSV for Excel' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Generate inventory' }));
  await screen.findByRole('button', { name: 'Download CSV for Excel' });
  expect(state.get).toHaveBeenLastCalledWith('facility-a', { archive: 'exclude', departmentId: 'dept-a' });
  expect(screen.getByLabelText('Department')).toHaveValue('dept-a');
});
test('late response from prior hospital cannot display or export', async () => {
  let finish!: (value: AssetInventoryReport) => void;
  state.get.mockReturnValue(new Promise<AssetInventoryReport>(resolve => { finish = resolve; }));
  const view = render(page()); fireEvent.click(screen.getByRole('button', { name: 'Generate inventory' }));
  state.facility = 'facility-b'; view.rerender(page());
  await act(async () => finish(fixture()));
  expect(screen.queryByRole('link', { name: 'A-1' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Download CSV for Excel' })).not.toBeInTheDocument();
});
test('unavailable response is not an empty successful report', async () => {
  state.get.mockRejectedValue({ response: { data: { error: 'Report exceeds limit' } } });
  render(page()); fireEvent.click(screen.getByRole('button', { name: 'Generate inventory' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Report exceeds limit');
  expect(screen.queryByRole('button', { name: 'Download CSV for Excel' })).not.toBeInTheDocument();
});
test('empty report allows export of explicit zero and report metadata', async () => {
  state.get.mockResolvedValue({ ...fixture(), rows: [], rowCount: 0 });
  render(page()); fireEvent.click(screen.getByRole('button', { name: 'Generate inventory' }));
  expect(await screen.findByText('No assets match these filters.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download CSV for Excel' })).toBeInTheDocument();
});
test('CSV quotes multiline fields, neutralizes formulas, and preserves blank unknown PM dates', () => {
  const report = fixture(); report.rows[0].ctrlNumber = '\t=1+1'; report.rows[0].description = 'Line 1, "quoted"\nLine 2';
  const csv = inventoryReportCsv(report);
  expect(csv).toContain('"\'\t=1+1"'); expect(csv).toContain('"Line 1, ""quoted""\nLine 2"');
  expect(csv).toContain('"Asset count","1"'); expect(csv).toContain('"Generated (UTC)","2026-11-16T12:00:00.000Z"');
  expect(csv).toContain('"resolved","Room 1","Active","false","","","","asset-a"');
});
