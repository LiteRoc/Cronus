import { beforeEach, afterEach, expect, test } from 'vitest';
import type { AxiosAdapter } from 'axios';
import apiClient from './apiClient';
import { getInventoryOptions, getInventoryReport } from './inventoryReportAPI';
const original = apiClient.defaults.adapter;
let sent: any, response: any;
beforeEach(() => {
  localStorage.setItem('selectedFacilityId', 'stale-facility');
  response = { schemaVersion: 'asset-inventory-v1', facility: { id: 'chosen' }, rows: [], rowCount: 0 };
  apiClient.defaults.adapter = (async config => { sent = config; return { data: response, status: 200, statusText: 'OK', headers: {}, config }; }) satisfies AxiosAdapter;
});
afterEach(() => { apiClient.defaults.adapter = original; localStorage.clear(); });
test('explicit report Facility wins over stale browser selection', async () => {
  await getInventoryReport('chosen', { status: 'Active' });
  expect(sent.headers.get('x-facility-id')).toBe('chosen'); expect(sent.params).toEqual({ status: 'Active' });
});
test('cross-Facility or incomplete response cannot be accepted as a report', async () => {
  response.facility.id = 'wrong'; await expect(getInventoryReport('chosen', {})).rejects.toThrow();
  response.facility.id = 'chosen'; response.rowCount = 1; await expect(getInventoryReport('chosen', {})).rejects.toThrow();
});
test('department choices have their own scoped request', async () => {
  response = { facilityId: 'chosen', departments: [] }; expect(await getInventoryOptions('chosen')).toEqual([]);
  expect(sent.url).toBe('/reports/inventory/options'); expect(sent.headers.get('x-facility-id')).toBe('chosen');
});
