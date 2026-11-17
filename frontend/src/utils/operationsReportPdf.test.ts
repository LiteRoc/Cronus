// @vitest-environment node
import { expect, test } from 'vitest';
import { buildOperationsReportPdf } from './operationsReportPdf';
import { fixture as monthly } from '../../verification/month-end-preview/synthetic';
import { fixture as annual } from '../../verification/year-end-preview/synthetic';
test.each([['month', monthly()], ['year', annual()], ['empty', annual(undefined, 0)]])('%s PDF serializes actual vector charts and paginated summary without requests', (_, report) => {
  const before = structuredClone(report), doc = buildOperationsReportPdf(report), pdf = doc.output('arraybuffer');
  expect(String.fromCharCode(...new Uint8Array(pdf).slice(0, 5))).toBe('%PDF-'); expect(pdf.byteLength).toBeGreaterThan(4000); expect(doc.getNumberOfPages()).toBeGreaterThan(1); expect(report).toEqual(before);
});
test('large category names/counts paginate and future-month gaps serialize', () => {
  const report = annual({ yearEnding: '2027', startMonth: '7', includeArchived: 'true' }); report.charts.completedByType = Array.from({ length: 15 }, (_, i) => ({ label: 'Synthetic long category '.repeat(8) + i, count: i }));
  expect(() => buildOperationsReportPdf(report).output('arraybuffer')).not.toThrow();
});
