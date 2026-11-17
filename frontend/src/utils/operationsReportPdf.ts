import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MonthEndReport } from '../types/MonthEndReport';
import type { YearEndReport } from '../types/YearEndReport';
type Report = MonthEndReport | YearEndReport;
const palette = ['#2563eb', '#0d9488', '#9333ea', '#ea580c', '#db2777', '#4f46e5'];
const amount = (n: number | null) => n === null ? 'Unavailable' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// PDF is composed from captured data, including vector charts, without DOM capture,
// network requests, remote fonts, or another query to the application services.
export function buildOperationsReportPdf(report: Report) {
  const annual = report.schemaVersion === 'year-end-v1', title = annual ? 'Year-end Operations' : 'Month-end Operations';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `${title} - ${report.facility.name}`, subject: 'Operational summary; current backlog separately identified', creator: 'Cronus' });
  let y = 38;
  function header() {
    doc.setFillColor('#1e40af'); doc.rect(0, 0, 210, 4, 'F'); doc.setTextColor('#1e3a8a'); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('The Sigma Asset Management Group', 14, 14);
    doc.setTextColor('#111827'); doc.setFontSize(18); doc.text(title, 14, 24); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(report.facility.name, 180).slice(0, 2), 14, 30);
  }
  function ensure(height: number) { if (y + height > 275) { doc.addPage(); header(); y = 42; } }
  function paragraph(value: string, color = '#374151') { const lines = doc.splitTextToSize(value, 180); for (const line of lines) { ensure(5); doc.setTextColor(color); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(line, 14, y); y += 4.5; } y += 2; }
  function heading(value: string) { ensure(12); doc.setTextColor('#1e3a8a'); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(value, 14, y + 5); y += 11; }
  function table(head: string[], body: (string | number)[][]) {
    ensure(22); autoTable(doc, { startY: y, margin: { top: 42, bottom: 19, left: 14, right: 14 }, head: [head], body, styles: { fontSize: 8, cellPadding: 2.4, overflow: 'linebreak' }, headStyles: { fillColor: '#1e40af' }, alternateRowStyles: { fillColor: '#eff6ff' }, didDrawPage: () => { header(); } });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }
  function bars(title: string, source: { label: string; count: number }[]) {
    const data = source.length > 8 ? [...source.slice(0, 7), { label: 'Remaining categories', count: source.slice(7).reduce((s, r) => s + r.count, 0) }] : source;
    ensure(20 + Math.max(1, data.length) * 8); heading(title);
    if (!data.length) { paragraph('No Work Orders in this cohort.'); return; }
    const max = Math.max(1, ...data.map(r => r.count));
    data.forEach((r, i) => { doc.setFontSize(8); doc.setTextColor('#374151'); doc.text(doc.splitTextToSize(r.label, 65).slice(0, 1), 14, y + 4); doc.setFillColor(palette[i % palette.length]); doc.roundedRect(82, y, r.count / max * 95 || 0.2, 5, 1, 1, 'F'); doc.text(String(r.count), 182, y + 4); y += 8; }); y += 5;
    if (source.length > 8) paragraph('Chart combines remaining categories; CSV contains the full breakdown.');
  }
  header();
  const endDay = new Date(+new Date(report.period.endExclusive) - 86400000).toISOString().slice(0, 10);
  paragraph(`UTC period: ${report.period.start.slice(0, 10)} through ${endDay}. Generated: ${report.generatedAt}`);
  paragraph(`Completion cohort: ${report.filters.includeArchived === 'true' ? 'Completed plus dated Archived records' : 'Completed only'}. ${report.period.isInProgress ? 'REPORTING PERIOD IN PROGRESS - PROVISIONAL.' : 'Reporting period ended; live records remain editable.'}`, report.period.isInProgress ? '#92400e' : '#374151');
  const s = report.activity.summary;
  heading('Completion cohort summary');
  table(['Completed records', 'Internal labor hours', 'Internal travel hours', 'Known direct cost', 'Complete direct cost'], [[s.count, s.laborHours, s.travelHours, amount(s.cost.knownSubtotal), amount(s.cost.total)]]);
  paragraph('Hours and costs are current whole-Work-Order totals for this completion cohort, not hours worked or expenses incurred within the period. Known subtotal is not a complete total.');
  paragraph(`Vendor hours, separate from internal: known labor ${s.vendorKnownLaborHours}, known travel ${s.vendorKnownTravelHours}; missing vendor labor ${s.vendorMissingLaborHours}, missing vendor travel ${s.vendorMissingTravelHours}. Invalid internal time entries: ${s.invalidTimeEntries}.`);
  bars('Completed activity by Work Order type', report.charts.completedByType);
  const trend = annual ? report.charts.monthlyCompletions.map(r => ({ label: r.month, count: r.count })) : report.charts.dailyCompletions.map(r => ({ label: r.date.slice(-2), count: r.count }));
  ensure(70); heading(annual ? 'Monthly completion activity (UTC)' : 'Daily completion activity (UTC)');
  const max = Math.max(1, ...trend.map(r => r.count ?? 0)), width = 174 / Math.max(1, trend.length), baseY = y + 38;
  doc.setDrawColor('#94a3b8'); doc.line(16, baseY, 192, baseY);
  trend.forEach((r, i) => { const x = 17 + i * width, height = (r.count ?? 0) / max * 32; doc.setFillColor(r.count === null ? '#e2e8f0' : '#0d9488'); doc.rect(x, baseY - Math.max(height, 0.3), Math.max(1, width - 1), Math.max(height, 0.3), 'F'); doc.setTextColor('#374151'); doc.setFontSize(6); doc.text(r.count === null ? '-' : String(r.count), x, baseY - height - 1); doc.text(annual ? r.label.slice(2) : r.label, x, baseY + 4, { angle: annual ? 35 : 0 }); });
  y = baseY + (annual ? 14 : 10); if (annual) paragraph('Dash means future/unobserved month, not zero completed work.');
  heading('Current backlog at generation - not historical period-end backlog');
  paragraph(`${report.backlog.summary.count} open; ${report.backlog.summary.overdue} overdue; ${report.backlog.summary.missingDueDates} missing due dates. Captured ${report.generatedAt}.`);
  bars('Current backlog by work category', report.backlogBreakdown); bars('Current backlog by priority', report.charts.backlogByPriority);
  table(['Current backlog category', 'Open', 'Overdue', 'Missing due date'], report.backlogBreakdown.map(r => [r.label, r.count, r.overdue, r.missingDueDates]));
  if (annual) { heading('Monthly completion cohort totals'); table(['Month (UTC)', 'State', 'WOs', 'Labor h', 'Travel h', 'Known cost', 'Complete cost'], report.months.map(m => [m.month, m.state, ...[m.summary.count, m.summary.laborHours, m.summary.travelHours, amount(m.summary.cost.knownSubtotal), amount(m.summary.cost.total)].map(v => m.state === 'future' ? '-' : v)])); }
  heading('Report basis and limitations'); report.notes.forEach(note => paragraph(note));
  paragraph('This PDF is the management summary with charts and totals. Download the CSV for all captured completion and current-backlog Work Order details.');
  const pages = doc.getNumberOfPages(); for (let p = 1; p <= pages; p++) { doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#64748b'); doc.text(`Cronus | ${report.generatedAt} | Page ${p} of ${pages}`, 14, 289); }
  return doc;
}
