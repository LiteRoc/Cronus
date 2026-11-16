import type { AssetInventoryReport } from '../types/AssetInventoryReport';
function cell(value: unknown) {
  const raw = value == null ? '' : String(value);
  const safe = /^[\s\uFEFF]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function inventoryReportCsv(report: AssetInventoryReport) {
  const rows: unknown[][] = [
    ['Asset Inventory'], ['Hospital', report.facility.name], ['Hospital ID', report.facility.id], ['Generated (UTC)', report.generatedAt],
    ['Asset count', report.rowCount], ...Object.entries(report.filters).map(([key, value]) => [`Filter: ${key}`, value]),
    ...report.notes.map(note => ['Report basis', note]),
    ['Missing serial numbers', report.dataQuality.missingSerial], ['Unassigned departments', report.dataQuality.unassignedDepartment],
    ['Unavailable departments', report.dataQuality.unavailableDepartment], ['Missing next PM dates', report.dataQuality.missingNextPM], [],
    ['Control number', 'Manufacturer', 'Model', 'Description', 'Serial number', 'Equipment class', 'Department', 'Department reference', 'Location', 'Status', 'Archived', 'PM frequency', 'Last PM (UTC)', 'Next PM (UTC)', 'Asset ID'],
    ...report.rows.map(row => [row.ctrlNumber, row.manufacturer, row.model, row.description, row.serialNumber, row.equipmentClass,
      row.department, row.departmentState, row.location, row.status, row.isArchived, row.pmFrequency, row.lastPM, row.nextPM, row.id]),
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
