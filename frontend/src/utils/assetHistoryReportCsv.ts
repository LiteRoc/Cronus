import type { AssetHistoryReport } from '../types/AssetHistoryReport';
const cell = (value: unknown) => { const raw = value == null ? '' : String(value); const safe = /^[\s\uFEFF]*[=+@-]/.test(raw) ? `'${raw}` : raw; return `"${safe.replace(/"/g, '""')}"`; };
export function assetHistoryReportCsv(report: AssetHistoryReport) {
  const rows: unknown[][] = [['Asset Detail and Service History'], ['Hospital', report.facility.name], ['Hospital ID', report.facility.id], ['Generated (UTC)', report.generatedAt],
    ...Object.entries(report.asset).map(([key, value]) => [`Asset: ${key}`, value]), ...Object.entries(report.filters).map(([key, value]) => [`Filter: ${key}`, value]),
    ['Work Order count', report.summary.workOrderCount], ['Archived Work Orders', report.summary.archivedCount], ['Recorded internal labor hours', report.summary.laborHours], ['Recorded internal travel hours', report.summary.travelHours],
    ['Invalid time entries', report.summary.invalidTimeEntries], ['Missing request dates', report.summary.missingRequestDates], ['Fully priced Work Orders', report.summary.fullyPricedCount],
    ...report.notes.map(note => ['Report basis', note]), [], ['Cost scope', 'Known subtotal', 'Complete total', 'Complete'],
    ...Object.entries({ ...report.summary.components, ...report.summary.scopes }).map(([name, scope]) => [name, scope.knownSubtotal, scope.total, scope.isComplete]), [],
    ['Work Order', 'Work Order ID', 'Requested (UTC)', 'Completed (UTC)', 'Type', 'Current status', 'Description', 'Internal labor hours', 'Internal travel hours', 'Invalid time entries', 'Known direct cost', 'Complete direct cost', 'Cost complete', 'Missing cost reasons', 'Recorded service notes', 'Parts (current catalog labels)', 'Recorded vendor', 'Vendor Work Order', 'Vendor labor hours', 'Vendor travel hours'],
    ...report.rows.map(row => [row.number, row.id, row.requested, row.completed, row.type, row.status, row.description, row.labor.recorded, row.travel.recorded, row.labor.invalidEntries + row.travel.invalidEntries,
      row.scopes.directMaintenance.knownSubtotal, row.scopes.directMaintenance.total, row.scopes.directMaintenance.isComplete, row.scopes.directMaintenance.missingComponents.map(item => item.reason).join('; '),
      row.serviceNotes.map(note => `${note.workDate}: ${note.description}`).join('\n'), row.parts.map(part => `${part.number || part.id || 'Unavailable part'} | ${part.description} | qty ${part.quantity ?? 'unknown'} | ${part.note} | ${part.referenceState}`).join('\n'),
      row.vendor?.name, row.vendor?.workOrderNumber, row.vendor?.laborHours, row.vendor?.travelHours]),
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
