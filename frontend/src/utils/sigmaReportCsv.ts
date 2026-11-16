import type { SigmaReport } from '../types/SigmaReport';

// Quote every cell and neutralize spreadsheet formula prefixes, including whitespace.
const cell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  const safe = /^[\s\uFEFF]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
export function sigmaReportCsv(report: SigmaReport): string {
  const rows: unknown[][] = [
    ['Sigma internal Contract report'], ['Contract', report.contract.number, report.contract.name],
    ['Facility ID', report.contract.facilityId], ['Start date (UTC)', report.period.startDate], ['End date (inclusive UTC)', report.period.endDate],
    ['Generated at', report.generatedAt], ['Prorated contract value', report.contractValue],
    ['Contribution', 'Unavailable'], ['Margin', 'Unavailable'],
    ['Work orders', report.activity.total], ['Open now', report.activity.open], ['Closed now', report.activity.closed],
    ['Preventive work orders', report.activity.preventive], ['Recorded labor hours', report.activity.laborHours], ['Recorded travel hours', report.activity.travelHours],
    [], ['Cost category', 'Known subtotal', 'Complete total', 'Complete', 'Fully priced work orders', 'Work order count'],
    ...Object.entries({ ...report.costs.components, vendorDirect: report.costs.scopes.vendorDirect, directMaintenance: report.costs.scopes.directMaintenance })
      .map(([name, cost]) => [name, cost.knownSubtotal, cost.total, cost.isComplete, cost.fullyPricedCount, cost.workOrderCount]),
    [], ['Report basis and limitations'], ...report.warnings.map(warning => [warning]), [],
    ['Work order', 'Work order ID', 'Asset ID', 'Request date (UTC)', 'Type', 'Current status', 'Recorded labor hours', 'Recorded travel hours', 'Known direct cost', 'Complete direct cost', 'Cost complete', 'Missing cost reasons'],
    ...report.workOrders.map(row => [row.number, row.id, row.assetId, row.requestDate, row.type, row.status, row.laborHours, row.travelHours,
      row.cost.knownSubtotal, row.cost.total, row.cost.isComplete, row.cost.missingComponents.map(item => item.reason ?? 'unknown').join('; ')]),
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
