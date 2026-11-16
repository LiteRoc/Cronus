import { expect, test, vi } from 'vitest';
import apiClient from './apiClient'; import { getMonthEndReport } from './monthEndReportAPI';
import { fixture } from '../../verification/month-end-preview/synthetic';
vi.mock('./apiClient', () => ({ default: { get: vi.fn() } }));
test('explicit facility, month and archive context checked for both cohorts', async () => {
  const r = fixture(), f = r.filters, id = r.facility.id; vi.mocked(apiClient.get).mockResolvedValue({ data: r }); await expect(getMonthEndReport(id, f)).resolves.toEqual(r); expect(apiClient.get).toHaveBeenLastCalledWith('/reports/month-end', { headers: { 'x-facility-id': id }, params: f });
  await expect(getMonthEndReport('foreign', f)).rejects.toThrow(); await expect(getMonthEndReport(id, { ...f, month: '2026-09' })).rejects.toThrow(); r.backlog.facility = { id: 'foreign', name: 'Other' }; await expect(getMonthEndReport(id, f)).rejects.toThrow();
});
