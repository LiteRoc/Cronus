const monthly = require('./monthEndReport');
function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }
function periodFor(filters) {
  const year = Number(filters.yearEnding), startMonth = Number(filters.startMonth);
  const start = new Date(Date.UTC(startMonth === 1 ? year : year - 1, startMonth - 1, 1)), end = new Date(start); end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { yearEnding: filters.yearEnding, startMonth: filters.startMonth, start: start.toISOString(), endExclusive: end.toISOString() };
}
function parseFilters(query, generatedAt = new Date()) {
  if (Object.keys(query).some(k => !['yearEnding', 'startMonth', 'includeArchived'].includes(k)) || Object.values(query).some(v => typeof v !== 'string' || v.length > 10)) invalid('Invalid year-end filter');
  const filters = { yearEnding: query.yearEnding?.trim(), startMonth: query.startMonth || '1', includeArchived: query.includeArchived || 'false' };
  if (!/^\d{4}$/.test(filters.yearEnding || '') || Number(filters.yearEnding) < 1901 || !/^(?:[1-9]|1[0-2])$/.test(filters.startMonth) || !['true', 'false'].includes(filters.includeArchived)) invalid('Select a valid year ending, start month and archive option');
  if (+new Date(periodFor(filters).start) > +generatedAt) invalid('Reporting year has not started yet');
  return filters;
}
function queries(facilityId, filters, generatedAt = new Date()) {
  const p = periodFor(filters), base = monthly.queries(facilityId, { month: p.start.slice(0, 7), includeArchived: filters.includeArchived });
  base.completed.completionDate = { $gte: new Date(p.start), $lt: new Date(Math.min(+new Date(p.endExclusive), +generatedAt)) };
  return base;
}
function buildReport(input) {
  const { filters, generatedAt = new Date(), completed } = input, p = periodFor(filters);
  const base = monthly.buildReport({ ...input, generatedAt, filters: { month: p.start.slice(0, 7), includeArchived: filters.includeArchived } });
  const months = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(p.start); start.setUTCMonth(start.getUTCMonth() + i); const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
    const selected = completed.filter(row => row.completionDate != null && +new Date(row.completionDate) >= +start && +new Date(row.completionDate) < +end);
    const summary = monthly.buildReport({ ...input, generatedAt, filters: { month: start.toISOString().slice(0, 7), includeArchived: filters.includeArchived }, completed: selected, backlog: [], assets: [] }).activity.summary;
    return { month: start.toISOString().slice(0, 7), state: +start > +generatedAt ? 'future' : +end > +generatedAt ? 'in_progress' : 'complete', summary };
  });
  return { schemaVersion: 'year-end-v1', generatedAt: base.generatedAt, facility: base.facility, filters,
    period: { ...p, isInProgress: +generatedAt < +new Date(p.endExclusive) }, activity: base.activity, backlog: base.backlog, backlogBreakdown: base.backlogBreakdown, months,
    charts: { completedByType: base.charts.completedByType, backlogByPriority: base.charts.backlogByPriority, monthlyCompletions: months.map(m => ({ month: m.month, count: m.state === 'future' ? null : m.summary.count })) },
    notes: ['The reporting year is labeled by the year it ends. January start means January–December of that year; other start months span the preceding and ending years. All boundaries use UTC.',
      'Activity uses current Completed status and completion timestamps within the reporting year, strictly before generation for a year in progress. Optional Archived records also require completion dates. Missing dates and deleted records are excluded. Future reporting months are not observed zero activity.',
      'Recorded internal and vendor hours and costs are current whole-Work-Order totals for the completion cohort, not hours worked or expenses incurred within the year or month. Internal/vendor hours remain separate; missing evidence stays unknown. Annual hours are summed from raw minutes and rounded once, so displayed rounded months may differ by a rounding unit.',
      ...base.notes.filter(n => n.startsWith('Current backlog') || n.startsWith('Charts show')).map(n => n.replaceAll('month-end', 'year-end')),
      'This is a live operational report, not an atomic snapshot, frozen financial close or PM compliance report. Backlog is current at generation, never historical year-end backlog. Current reporting years are provisional; later record edits can change past results.'] };
}
module.exports = { parseFilters, periodFor, queries, buildReport };
