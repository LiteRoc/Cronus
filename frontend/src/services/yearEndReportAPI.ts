import apiClient from './apiClient';
import type { YearEndFilters, YearEndReport } from '../types/YearEndReport';
export async function getYearEndReport(facilityId: string, filters: YearEndFilters): Promise<YearEndReport> {
  const { data } = await apiClient.get<YearEndReport>('/reports/year-end', { headers: { 'x-facility-id': facilityId }, params: filters });
  if (data?.schemaVersion !== 'year-end-v1' || data.facility?.id !== facilityId || data.filters?.yearEnding !== filters.yearEnding || data.filters?.startMonth !== filters.startMonth || data.filters?.includeArchived !== filters.includeArchived || !Array.isArray(data.activity?.rows) || data.activity.rows.length !== data.activity.summary?.count || data.backlog?.facility?.id !== facilityId || !Array.isArray(data.backlog.rows) || data.backlog.rows.length !== data.backlog.summary?.count || !Array.isArray(data.months) || data.months.length !== 12) throw new Error('Invalid year-end response');
  return data;
}
