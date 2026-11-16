const { buildReport: workOrderReport, queryFor } = require('./workOrderReport');
function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }
function parseFilters(query, generatedAt = new Date()) {
  if (Object.keys(query).some(k => !['month', 'includeArchived'].includes(k)) || Object.values(query).some(v => typeof v !== 'string')) invalid('Invalid month-end filter');
  const month = query.month?.trim(), includeArchived = query.includeArchived || 'false';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '') || Number(month.slice(0, 4)) < 1900 || month > generatedAt.toISOString().slice(0, 7) || !['false', 'true'].includes(includeArchived)) invalid('Select a valid current or past month and archive option');
  return { month, includeArchived };
}
function periodFor(filters) {
  const start = new Date(`${filters.month}-01T00:00:00.000Z`), end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  return { month: filters.month, start: start.toISOString(), endExclusive: end.toISOString() };
}
function queries(facilityId, filters) {
  const period = periodFor(filters);
  return { completed: { facilityId, deletedAt: null, status: { $in: filters.includeArchived === 'true' ? ['Completed', 'Archived'] : ['Completed'] }, completionDate: { $gte: new Date(period.start), $lt: new Date(period.endExclusive) } }, backlog: queryFor(facilityId, { mode: 'open' }) };
}
const finite = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const round = v => Math.round(v * 100) / 100;
function minutes(logs, field) { const entries = Array.isArray(logs) ? logs : []; return { minutes: entries.reduce((s, l) => s + (finite(l?.[field]) ? l[field] : 0), 0), invalid: logs != null && !Array.isArray(logs) ? 1 : entries.filter(l => !finite(l?.[field])).length }; }
function groups(rows, field) { const map = new Map(); for (const row of rows) { const label = row[field] || 'Not recorded'; map.set(label, (map.get(label) || 0) + 1); } return [...map].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)); }
function backlogCategory(type) {
  if (['Planned Maintenance', 'Preventive Maintenance', 'PM'].includes(type)) return 'Open PM';
  if (['Corrective Maintenance', 'CM'].includes(type)) return 'Open corrective';
  return 'Other open work';
}
function buildReport({ facility, filters, completed, backlog, assets = [], generatedAt = new Date() }) {
  const activity = workOrderReport({ facility, filters: { mode: 'closed' }, workOrders: completed, assets, generatedAt });
  const current = workOrderReport({ facility, filters: { mode: 'open' }, workOrders: backlog, assets, generatedAt });
  const time = completed.map(row => ({ labor: minutes(row.timeLogs, 'timeSpent'), travel: minutes(row.travelLogs, 'travelTime'), vendor: row.vendorService }));
  const rows = activity.rows.map((row, i) => ({ ...row, laborHours: round(time[i].labor.minutes / 60), travelHours: round(time[i].travel.minutes / 60), invalidTimeEntries: time[i].labor.invalid + time[i].travel.invalid,
    vendorLaborHours: finite(time[i].vendor?.laborHours) ? time[i].vendor.laborHours : null, vendorTravelHours: finite(time[i].vendor?.travelHours) ? time[i].vendor.travelHours : null }));
  const period = periodFor(filters), daily = new Map();
  for (let day = new Date(period.start); +day < +new Date(period.endExclusive); day.setUTCDate(day.getUTCDate() + 1)) daily.set(day.toISOString().slice(0, 10), 0);
  for (const row of rows) if (row.completed && daily.has(row.completed.slice(0, 10))) daily.set(row.completed.slice(0, 10), daily.get(row.completed.slice(0, 10)) + 1);
  const vendors = time.filter(t => t.vendor != null);
  const backlogBreakdown = ['Open PM', 'Open corrective', 'Other open work'].map(label => {
    const selected = current.rows.filter(row => backlogCategory(row.type) === label);
    return { label, count: selected.length, overdue: selected.filter(row => row.overdue === true).length, missingDueDates: selected.filter(row => !row.due).length };
  });
  return { schemaVersion: 'month-end-v1', generatedAt: generatedAt.toISOString(), facility: activity.facility, filters,
    period: { ...period, isInProgress: +generatedAt < +new Date(period.endExclusive) },
    activity: { summary: { ...activity.summary, laborHours: round(time.reduce((s, t) => s + t.labor.minutes, 0) / 60), travelHours: round(time.reduce((s, t) => s + t.travel.minutes, 0) / 60),
      invalidTimeEntries: time.reduce((s, t) => s + t.labor.invalid + t.travel.invalid, 0),
      vendorKnownLaborHours: round(vendors.reduce((s, t) => s + (finite(t.vendor.laborHours) ? t.vendor.laborHours : 0), 0)), vendorKnownTravelHours: round(vendors.reduce((s, t) => s + (finite(t.vendor.travelHours) ? t.vendor.travelHours : 0), 0)),
      vendorMissingLaborHours: vendors.filter(t => !finite(t.vendor.laborHours)).length, vendorMissingTravelHours: vendors.filter(t => !finite(t.vendor.travelHours)).length }, rows },
    backlog: current,
    backlogBreakdown,
    charts: { completedByType: groups(rows, 'type'), backlogByPriority: groups(current.rows, 'priority'), dailyCompletions: [...daily].map(([date, count]) => ({ date, count })) },
    notes: ['Activity includes current Completed Work Orders with completion timestamps within the selected UTC calendar month. Archived records are optional and require a completion date; archive status alone does not certify completion. Deleted records and missing completion dates are excluded.',
      'Recorded labor, travel and costs are current whole-Work-Order totals for the selected completion cohort, not time worked or expenses incurred within the month. Internal and vendor hours remain separate. Invalid internal entries and missing vendor hours are disclosed.',
      'Current backlog is captured at generation time and is not reconstructed month-end backlog. Activity and backlog are separate cohorts and must not be added into one period expense total.',
      'Current backlog categories: Open PM uses exact Planned Maintenance, Preventive Maintenance or PM; Open corrective uses exact Corrective Maintenance or CM. All other or missing types are Other open work. Categories are mutually exclusive and include all captured open Work Orders.',
      'Charts show counts from captured records. Asset labels are current hospital-scoped references; missing/deleted/foreign assets remain unavailable. No PM compliance, historical coverage, financial margin or completeness certification is inferred.',
      'This report reads live records in separate bounded queries, not an atomic or immutable historical snapshot. Current-month reports are in progress and later record edits can change previous months.'] };
}
module.exports = { parseFilters, periodFor, queries, buildReport };
