import { expect, test, vi } from 'vitest';
import { getWorkOrderReport } from './workOrderReportAPI';
import apiClient from './apiClient';
vi.mock('./apiClient', () => ({ default: { get: vi.fn() } }));
test('explicit hospital context and mode are sent; foreign or mismatched payloads rejected', async () => {
  const data = { schemaVersion: 'work-order-report-v1', facility: { id: 'f' }, filters: { mode: 'open' }, rows: [], summary: { count: 0 } };
  vi.mocked(apiClient.get).mockResolvedValue({ data }); await expect(getWorkOrderReport('f', { mode: 'open' })).resolves.toEqual(data);
  expect(apiClient.get).toHaveBeenLastCalledWith('/reports/work-orders', { headers: { 'x-facility-id': 'f' }, params: { mode: 'open' } });
  await expect(getWorkOrderReport('other', { mode: 'open' })).rejects.toThrow(); await expect(getWorkOrderReport('f', { mode: 'closed' })).rejects.toThrow();
});
