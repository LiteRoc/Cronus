import type { HistoryCost } from './AssetHistoryReport';
export interface WorkOrderReportFilters { mode: 'open' | 'closed' | 'pm'; startDate?: string; endDate?: string; priority?: string; workOrderType?: string; includeArchived?: string; dueStatus?: string }
export interface WorkOrderReport {
  schemaVersion: 'work-order-report-v1'; generatedAt: string; facility: { id: string; name: string }; filters: WorkOrderReportFilters;
  summary: { count: number; overdue: number; missingDueDates: number; missingRequestDates: number; unavailableAssets: number; archived: number; cost: HistoryCost };
  rows: { id: string; number: string | number; status: string; priority: string; type: string; description: string;
    asset: { id: string; controlNumber: string; manufacturer: string; model: string } | null;
    requested: string | null; scheduled: string | null; due: string | null; completed: string | null; ageDays: number | null; overdue: boolean | null; cost: HistoryCost }[];
  notes: string[];
}
