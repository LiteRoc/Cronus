import { canonicalCosts, scopeOf } from './workOrderCostAdapter.js';
import { proratedValueBetween } from './contractValueService.js';

const DAY = 86400000;
const id = value => String(value?._id ?? value ?? '');
const round = value => Math.round(value * 100) / 100;
function badInput(message) {
  return Object.assign(new Error(message), { status: 400 });
}
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badInput('Dates must use YYYY-MM-DD');
  const result = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(+result) || result.toISOString().slice(0, 10) !== value) throw badInput('Invalid calendar date');
  return result;
}
export function reportPeriod(start, end) {
  const from = day(start), through = day(end);
  if (through < from) throw badInput('End date must be on or after start date');
  if (through - from > DAY * 366 * 5) throw badInput('Choose a reporting period of five years or less');
  return { start: from, endExclusive: new Date(+through + DAY), startDate: start, endDate: end };
}
const hours = (logs, field) => (logs ?? []).reduce((sum, log) => {
  const value = Number(log[field]);
  return sum + (Number.isFinite(value) && value >= 0 ? value / 60 : 0);
}, 0);
const closed = row => ['completed', 'closed', 'archived'].includes(String(row.status).toLowerCase()) || Boolean(row.closedAt || row.completionDate);

// Read-only report. Explicit Contract linkage, not reconstructed historical membership.
export async function buildSigmaReport({ contract, coreClient, period, generatedAt = new Date() }) {
  const termStart = new Date(contract.startDate), termEnd = new Date(contract.endDate);
  if (!contract.startDate || !contract.endDate || !Number.isFinite(+termStart) || !Number.isFinite(+termEnd) || termEnd <= termStart ||
      !Number.isFinite(contract.totalValue) || contract.totalValue < 0) throw new Error('Contract financial inputs unavailable');
  const start = new Date(Math.max(+period.start, +termStart));
  const end = new Date(Math.min(+period.endExclusive, +termEnd));
  let rows = [];
  if (end > start) {
    const { data } = await coreClient.get(`/workorders/by-contract/${id(contract._id)}`, {
      params: { start: start.toISOString(), end: new Date(+end - 1).toISOString(), dateField: 'requestDate' },
      timeout: 30000,
    });
    if (!Array.isArray(data?.workOrders)) throw new Error('Work Order report unavailable');
    rows = data.workOrders;
    const seen = new Set();
    for (const row of rows) {
      const requested = new Date(row.requestDate);
      if (!/^[a-f\d]{24}$/i.test(id(row._id)) || seen.has(id(row._id)) ||
          id(row.facilityId) !== id(contract.facilityId) || id(row.contractId) !== id(contract._id) ||
          !Number.isFinite(+requested) || requested < start || requested >= end || row.status === 'Archived') {
        throw new Error('Work Order report scope could not be verified');
      }
      seen.add(id(row._id));
    }
  }
  const costs = canonicalCosts(rows);
  const warnings = [
    'Work orders are selected by recorded Contract linkage and request date (UTC), clipped to the Contract term. Archived work orders are excluded.',
    'Costs and service hours are current totals for these work orders, including entries outside the selected period. This is not a period expense ledger or historical snapshot.',
    'Prorated contract value uses the current applied amendment timeline and the existing 365-day convention. It is not invoiced, collected, or accounting-recognized revenue.',
    'Period contribution and margin are unavailable until expense dates and vendor payout attribution are reconciled. Overhead is not included.',
  ];
  if (contract.vendorLinks?.length) warnings.push('Recurring vendor agreements are not included in direct work-order costs. Their payouts may overlap recorded vendor expenses.');
  if (period.endExclusive > generatedAt) warnings.push('The selected period includes future time; contract value includes that time, while service records are current.');
  return {
    schemaVersion: 'sigma-contract-report-v1', generatedAt: generatedAt.toISOString(),
    contract: { id: id(contract._id), name: contract.name ?? '', number: contract.contractNumber ?? '', facilityId: id(contract.facilityId), status: contract.status },
    period: { startDate: period.startDate, endDate: period.endDate, timeZone: 'UTC', effectiveStart: end > start ? start.toISOString() : null, effectiveEndExclusive: end > start ? end.toISOString() : null },
    contractValue: round(proratedValueBetween(contract, period.start, period.endExclusive)),
    costs: { scopes: costs.scopes, components: costs.components },
    activity: { total: rows.length, closed: rows.filter(closed).length, open: rows.filter(row => !closed(row)).length,
      preventive: rows.filter(row => row.type === 'PM' || row.workOrderType === 'Preventive Maintenance').length,
      laborHours: round(rows.reduce((sum, row) => sum + hours(row.timeLogs, 'timeSpent'), 0)),
      travelHours: round(rows.reduce((sum, row) => sum + hours(row.travelLogs, 'travelTime'), 0)) },
    contribution: null, marginPercent: null, warnings,
    workOrders: rows.map(row => ({ id: id(row._id), number: row.workOrderNumber ?? '', assetId: id(row.assetId),
      requestDate: new Date(row.requestDate).toISOString(), type: row.workOrderType ?? row.type ?? '', status: row.status ?? '',
      laborHours: round(hours(row.timeLogs, 'timeSpent')), travelHours: round(hours(row.travelLogs, 'travelTime')),
      cost: scopeOf(row, 'directMaintenance') })),
  };
}
