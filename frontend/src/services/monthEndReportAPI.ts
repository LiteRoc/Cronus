import apiClient from './apiClient';
import type { MonthEndFilters, MonthEndReport } from '../types/MonthEndReport';
export async function getMonthEndReport(facilityId: string, filters: MonthEndFilters): Promise<MonthEndReport> {
  const { data } = await apiClient.get<MonthEndReport>('/reports/month-end', { headers: { 'x-facility-id': facilityId }, params: filters });
  if (data?.schemaVersion !== 'month-end-v1' || data.facility?.id !== facilityId || data.filters?.month !== filters.month || data.filters?.includeArchived !== filters.includeArchived || !Array.isArray(data.activity?.rows) || data.activity.rows.length !== data.activity.summary?.count || data.backlog?.facility?.id !== facilityId || !Array.isArray(data.backlog.rows) || data.backlog.rows.length !== data.backlog.summary?.count) throw new Error('Invalid month-end response');
  return data;
}
