import { afterEach, beforeEach, expect, test } from 'vitest';
import type { AxiosAdapter } from 'axios';
import apiClient from './apiClient';
import { getAssetHistoryReport } from './assetHistoryReportAPI';
const original = apiClient.defaults.adapter; let result: any, sent: any;
beforeEach(() => { localStorage.setItem('selectedFacilityId', 'stale'); result = { schemaVersion: 'asset-history-v1', facility: { id: 'chosen' }, asset: { id: 'abcdef000000000000000001', ctrlNumber: 'A-1' }, rows: [], summary: { workOrderCount: 0 } };
  apiClient.defaults.adapter = (async config => { sent = config; return { data: result, status: 200, statusText: 'OK', headers: {}, config }; }) satisfies AxiosAdapter;
});
afterEach(() => { apiClient.defaults.adapter = original; localStorage.clear(); });
test('explicit hospital header wins and uppercase asset ID is accepted', async () => { await getAssetHistoryReport('chosen', { assetId: 'ABCDEF000000000000000001' }); expect(sent.headers.get('x-facility-id')).toBe('chosen'); expect(sent.url).toBe('/reports/asset-history'); });
test('wrong asset, hospital or incomplete population response is rejected', async () => {
  await expect(getAssetHistoryReport('chosen', { controlNumber: 'wrong' })).rejects.toThrow();
  result.facility.id = 'foreign'; await expect(getAssetHistoryReport('chosen', { controlNumber: 'A-1' })).rejects.toThrow();
  result.facility.id = 'chosen'; result.summary.workOrderCount = 1; await expect(getAssetHistoryReport('chosen', { controlNumber: 'A-1' })).rejects.toThrow();
});
