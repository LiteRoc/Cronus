import apiClient from './apiClient';
import type { AssetInventoryReport, InventoryFilters } from '../types/AssetInventoryReport';

export async function getInventoryOptions(facilityId: string): Promise<{ id: string; name: string }[]> {
  const { data } = await apiClient.get('/reports/inventory/options', { headers: { 'x-facility-id': facilityId } });
  if (data.facilityId !== facilityId || !Array.isArray(data.departments)) throw new Error('Invalid report filter response');
  return data.departments;
}

export async function getInventoryReport(facilityId: string, filters: InventoryFilters): Promise<AssetInventoryReport> {
  const { data } = await apiClient.get<AssetInventoryReport>('/reports/inventory', {
    headers: { 'x-facility-id': facilityId }, params: filters,
  });
  if (data.schemaVersion !== 'asset-inventory-v1' || data.facility.id !== facilityId || !Array.isArray(data.rows) || data.rowCount !== data.rows.length) {
    throw new Error('Invalid inventory report response');
  }
  return data;
}
