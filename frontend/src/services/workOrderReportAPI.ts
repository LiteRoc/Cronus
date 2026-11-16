import apiClient from './apiClient';
import type { WorkOrderReport, WorkOrderReportFilters } from '../types/WorkOrderReport';
export async function getWorkOrderReport(facilityId: string, filters: WorkOrderReportFilters): Promise<WorkOrderReport> {
  const { data } = await apiClient.get<WorkOrderReport>('/reports/work-orders', { headers: { 'x-facility-id': facilityId }, params: filters });
  if (data?.schemaVersion !== 'work-order-report-v1' || data.facility?.id !== facilityId || data.filters?.mode !== filters.mode || !Array.isArray(data.rows) || data.rows.length !== data.summary?.count) throw new Error('Invalid Work Order report response');
  return data;
}
