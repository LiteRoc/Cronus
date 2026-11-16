import type { WorkOrderReport } from './WorkOrderReport';
export interface MonthEndFilters { month: string; includeArchived: string }
export interface MonthEndReport {
  schemaVersion: 'month-end-v1'; generatedAt: string; facility: { id: string; name: string }; filters: MonthEndFilters;
  period: { month: string; start: string; endExclusive: string; isInProgress: boolean };
  activity: { summary: WorkOrderReport['summary'] & { laborHours: number; travelHours: number; invalidTimeEntries: number; vendorKnownLaborHours: number; vendorKnownTravelHours: number; vendorMissingLaborHours: number; vendorMissingTravelHours: number };
    rows: (WorkOrderReport['rows'][number] & { laborHours: number; travelHours: number; invalidTimeEntries: number; vendorLaborHours: number | null; vendorTravelHours: number | null })[] };
  backlog: WorkOrderReport;
  backlogBreakdown: { label: string; count: number; overdue: number; missingDueDates: number }[];
  charts: { completedByType: { label: string; count: number }[]; backlogByPriority: { label: string; count: number }[]; dailyCompletions: { date: string; count: number }[] };
  notes: string[];
}
