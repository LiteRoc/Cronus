import type { MonthEndReport } from '../types/MonthEndReport';
import { workOrderReportCsv } from './workOrderReportCsv';
const cell = (v: unknown) => { const s = v == null ? '' : String(v); return `"${(/^[\s\uFEFF]*[=+@-]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; };
export function monthEndReportCsv(report: MonthEndReport) {
  const rows: unknown[][] = [['Month-end operational report', report.period.month], ['Hospital', report.facility.name], ['Hospital ID', report.facility.id], ['Generated (UTC)', report.generatedAt], ['Period start (UTC)', report.period.start], ['Period end exclusive (UTC)', report.period.endExclusive], ['Month in progress', report.period.isInProgress], ['Include archived', report.filters.includeArchived],
    ...report.notes.map(n => ['Report basis', n]), [], ['Completion cohort summary'], ...Object.entries(report.activity.summary).filter(([k]) => k !== 'cost').map(([k, v]) => [k, v]), ['Known direct cost subtotal', report.activity.summary.cost.knownSubtotal], ['Complete direct cost total', report.activity.summary.cost.total],
    [], ['Completed by type', 'Count'], ...report.charts.completedByType.map(r => [r.label, r.count]), [], ['Completion date (UTC)', 'Count'], ...report.charts.dailyCompletions.map(r => [r.date, r.count]), [], ['Current backlog priority', 'Count'], ...report.charts.backlogByPriority.map(r => [r.label, r.count]),
    [], ['Current backlog category - at generation', 'Work Orders', 'Overdue', 'Missing due dates'], ...report.backlogBreakdown.map(r => [r.label, r.count, r.overdue, r.missingDueDates]),
    [], ['Completion cohort Work Orders'], ['Work Order', 'ID', 'Status', 'Type', 'Control number', 'Completed (UTC)', 'Internal labor hours', 'Internal travel hours', 'Invalid time entries', 'Vendor labor hours', 'Vendor travel hours', 'Known direct cost', 'Complete direct cost', 'Missing cost reasons'],
    ...report.activity.rows.map(r => [r.number, r.id, r.status, r.type, r.asset?.controlNumber, r.completed, r.laborHours, r.travelHours, r.invalidTimeEntries, r.vendorLaborHours, r.vendorTravelHours, r.cost.knownSubtotal, r.cost.total, r.cost.missingComponents.map(c => c.reason).join('; ')])];
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n\r\n' + ['CURRENT BACKLOG AT GENERATION - NOT MONTH-END BACKLOG'].map(cell).join(',') + '\r\n' + workOrderReportCsv(report.backlog).slice(1);
}
