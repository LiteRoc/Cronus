import apiClient from './apiClient';
import type { AssetHistoryReport, HistoryFilters } from '../types/AssetHistoryReport';
export async function getAssetHistoryReport(facilityId: string, filters: HistoryFilters): Promise<AssetHistoryReport> {
  const { data } = await apiClient.get<AssetHistoryReport>('/reports/asset-history', { headers: { 'x-facility-id': facilityId }, params: filters });
  if (data?.schemaVersion !== 'asset-history-v1' || data.facility?.id !== facilityId || !Array.isArray(data.rows) || data.summary?.workOrderCount !== data.rows.length ||
      (filters.assetId && data.asset?.id !== filters.assetId.toLowerCase()) || (filters.controlNumber && data.asset?.ctrlNumber !== filters.controlNumber)) throw new Error('Invalid asset history response');
  return data;
}
