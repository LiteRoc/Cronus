import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sigmaReportCsv } from '../src/utils/sigmaReportCsv.ts';
import { buildSigmaReport, reportPeriod } from '../../contract-service/src/services/sigmaReportService.js';

const report = await buildSigmaReport({
  contract: { _id: '000000000000000000000001', facilityId: '000000000000000000000002', name: '=HYPERLINK("unsafe")', contractNumber: 'Synthetic, "quoted"\ncontract', totalValue: 3650, startDate: '2026-01-01', endDate: '2027-01-01' },
  period: reportPeriod('2026-01-01', '2026-01-31'), generatedAt: new Date('2026-02-01'),
  coreClient: { get: async () => ({ data: { workOrders: [] } }) },
});
test('Excel-compatible CSV contains report context, limitations and supporting column labels', () => {
  const csv = sigmaReportCsv(report);
  assert.ok(csv.startsWith('\uFEFF'));
  for (const text of ['2026-01-01', '2026-01-31', '310', 'not a period expense ledger', 'Missing cost reasons', 'Unavailable']) assert.ok(csv.includes(text));
  assert.ok(csv.includes('"Synthetic, ""quoted""\ncontract"'));
});
test('untrusted formula prefixes are neutralized including whitespace', () => {
  for (const name of ['=1+1', '+1', '-1', '@SUM(A1)', '\t=1', '\r\n=1']) {
    const csv = sigmaReportCsv({ ...report, contract: { ...report.contract, name } });
    assert.ok(csv.includes(`"'${name}"`));
  }
});
test('partial costs export known subtotal and blank unknown total, never zero total', () => {
  const copy = structuredClone(report);
  copy.costs.scopes.directMaintenance = { knownSubtotal: 125, total: null, isComplete: false, missingComponents: [{ reason: 'labor_unknown' }], workOrderCount: 1, fullyPricedCount: 0 };
  assert.ok(sigmaReportCsv(copy).includes('"directMaintenance","125","","false","0","1"'));
});
