import type { WorkOrderReport } from '../types/WorkOrderReport';
const cell = (value: unknown) => { const raw = value == null ? '' : String(value); return `"${(/^[\s\uFEFF]*[=+@-]/.test(raw) ? `'${raw}` : raw).replace(/"/g, '""')}"`; };
export function workOrderReportCsv(report: WorkOrderReport) {
  const rows: unknown[][] = [['Work Order report', report.filters.mode], ['Hospital', report.facility.name], ['Hospital ID', report.facility.id], ['Generated (UTC)', report.generatedAt],
    ...Object.entries(report.filters).map(([k, v]) => [`Filter: ${k}`, v]), ...Object.entries(report.summary).filter(([k]) => k !== 'cost').map(([k, v]) => [`Summary: ${k}`, v]),
    ['Known direct cost subtotal', report.summary.cost.knownSubtotal], ['Complete direct cost total', report.summary.cost.total], ...report.notes.map(n => ['Report basis', n]), [],
    ['Work Order', 'Work Order ID', 'Status', 'Priority', 'Type', 'Control number', 'Manufacturer', 'Model', 'Asset reference', 'Description', 'Requested (UTC)', 'Scheduled (UTC)', 'Due (UTC)', 'Completed (UTC)', 'Open age days', 'Overdue at generation', 'Known direct cost', 'Complete direct cost', 'Missing cost reasons'],
    ...report.rows.map(r => [r.number, r.id, r.status, r.priority, r.type, r.asset?.controlNumber, r.asset?.manufacturer, r.asset?.model, r.asset ? 'resolved' : 'unavailable', r.description, r.requested, r.scheduled, r.due, r.completed, r.ageDays, r.overdue, r.cost.knownSubtotal, r.cost.total, r.cost.missingComponents.map(m => m.reason).join('; ')])];
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}
