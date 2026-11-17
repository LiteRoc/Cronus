import type { MonthEndReport } from './MonthEndReport';
export interface YearEndFilters { yearEnding: string; startMonth: string; includeArchived: string }
export interface YearEndReport extends Omit<MonthEndReport, 'schemaVersion' | 'filters' | 'period' | 'charts'> {
  schemaVersion: 'year-end-v1'; filters: YearEndFilters;
  period: { yearEnding: string; startMonth: string; start: string; endExclusive: string; isInProgress: boolean };
  months: { month: string; state: 'future' | 'in_progress' | 'complete'; summary: MonthEndReport['activity']['summary'] }[];
  charts: { completedByType: { label: string; count: number }[]; backlogByPriority: { label: string; count: number }[]; monthlyCompletions: { month: string; count: number | null }[] };
}
