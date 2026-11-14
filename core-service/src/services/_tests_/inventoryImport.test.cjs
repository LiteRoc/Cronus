const { test } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { parseExcel, parseWorkbook } = require('../inventoryImport');

function workbook(rows, date1904 = false) {
  return { SheetNames: ['Assets'], Sheets: { Assets: XLSX.utils.aoa_to_sheet(rows) }, Workbook: { WBProps: { date1904 } } };
}
const headers = ['Tag #', 'Manufacturer', 'Model', 'Model Number', 'Serial Number', 'FDA Device Identifier', 'Date Acquired', 'Purchase Cost'];
const asset = ['SYN-001', 'Synthetic Maker', 'Family', 'Specific Model', '000964', '00123456789012', 45679, 0];

test('reads an actual XLSX buffer, preserves text/model/source values, permits missing template', () => {
  const wb = workbook([headers, asset]);
  wb.Sheets.Assets.G2.z = 'mm/dd/yyyy';
  const bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const before = Buffer.from(bytes);
  const report = parseExcel(bytes);
  assert.equal(report.valid, true);
  assert.equal(report.rows.length, 1);
  const a = report.rows[0].asset;
  assert.equal(a.serialNumber, '000964');
  assert.equal(a.fdaDI, '00123456789012');
  assert.equal(a.model, 'Family');
  assert.equal(a.modelNumber, 'Specific Model');
  assert.equal(a.acquisitionDate, '2025-01-22');
  assert.equal(a.templateId, null);
  assert.equal(a.reportedPurchaseCost, 0);
  assert.equal(a.verifiedPurchasePrice, null);
  assert.equal(report.rows[0].source.find(c => c.header === 'Date Acquired').value, 45679);
  assert.deepEqual(bytes, before);
});

test('retains unknown columns, whitespace, long UDI and sheet row numbers', () => {
  const wb = workbook([headers.concat(['FDA Unique Device Identifier', 'Extra']), [], asset.concat(['0000000000000000000000123456789', ' untouched '])]);
  const before = structuredClone(wb);
  const report = parseWorkbook(wb);
  assert.equal(report.rows[0].row, 3);
  assert.equal(report.rows[0].asset.fdaUDI, '0000000000000000000000123456789');
  assert.equal(report.rows[0].source.at(-1).value, ' untouched ');
  assert.ok(report.issues.some(i => i.code === 'UNKNOWN_COLUMN'));
  assert.deepEqual(wb, before);
});

test('missing columns/values, duplicate headers/tags block validation', () => {
  for (const wb of [workbook([['Tag #'], ['SYN-1']]), workbook([headers, ['', ...asset.slice(1)]]), workbook([headers.concat('Model'), asset.concat('Other')]), workbook([headers, asset, asset])]) {
    assert.equal(parseWorkbook(wb).valid, false);
  }
  assert.ok(parseWorkbook(workbook([headers, asset, asset])).issues.some(i => i.code === 'DUPLICATE_TAG' && i.row === 3));
});

test('formula cached values and Excel errors are never accepted as literal values', () => {
  for (const replacement of [{ t: 's', f: '"cached"', v: 'cached' }, { t: 'e', v: 7 }]) {
    const wb = workbook([headers, asset]);
    wb.Sheets.Assets.A2 = replacement;
    const report = parseWorkbook(wb);
    assert.equal(report.valid, false);
    assert.equal(report.rows[0].asset.ctrlNumber, undefined);
  }
});

test('numeric identifiers block preview rather than silently accepting lost digits', () => {
  const row = [...asset]; row[5] = 1234567890123456;
  const report = parseWorkbook(workbook([headers, row]));
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(i => i.code === 'NUMERIC_IDENTIFIER'));
});

test('handles both Excel epochs and leap-year bug, rejects ambiguous/impossible/time dates', () => {
  for (const [value, epoch, expected] of [[1, false, '1900-01-01'], [59, false, '1900-02-28'], [61, false, '1900-03-01'], [0, true, '1904-01-01'], [45679, false, '2025-01-22'], [45805, false, '2025-05-28'], [46339, false, '2026-11-13'], ['2024-02-29', false, '2024-02-29'], [60, false, null], [45679.5, false, null], ['01/02/2025', false, null], ['2025-02-29', false, null], [-1, false, null]]) {
    const row = [...asset]; row[6] = value;
    const report = parseWorkbook(workbook([headers, row], epoch));
    assert.equal(report.rows[0].asset.acquisitionDate, expected, String(value));
    assert.equal(report.valid, expected !== null, String(value));
  }
});

test('negative/text costs rejected, positive source costs remain unverified', () => {
  for (const value of [-1, '$1,000', 1000]) {
    const row = [...asset]; row[7] = value;
    const report = parseWorkbook(workbook([headers, row]));
    assert.equal(report.valid, value === 1000);
    assert.equal(report.rows[0].asset.verifiedPurchasePrice, null);
  }
});

test('empty, header-only and ambiguous worksheets fail closed', () => {
  assert.equal(parseWorkbook(workbook([])).valid, false);
  assert.equal(parseWorkbook(workbook([headers])).valid, false);
  const wb = workbook([headers, asset]); wb.SheetNames.push('Other'); wb.Sheets.Other = {};
  assert.equal(parseWorkbook(wb).valid, false);
  assert.equal(parseWorkbook(wb, { sheetName: 'Assets' }).valid, true);
  assert.equal(parseWorkbook(wb, { sheetName: 'Missing' }).valid, false);
});

test('bounds file/worksheet size and rejects non-XLSX inputs', () => {
  assert.throws(() => parseExcel('file.xlsx'));
  assert.throws(() => parseExcel(Buffer.from('Tag #,Manufacturer,Model')));
  assert.throws(() => parseExcel(Buffer.alloc(20 * 1024 * 1024 + 1)));
  const wb = workbook([headers, asset]); wb.Sheets.Assets['!ref'] = 'A1:A100002';
  assert.throws(() => parseWorkbook(wb), /limits/);
});

test('unresolved department/status and possible duplicates are review warnings', () => {
  const row1 = asset.concat(['Synthetic department', 'Source-only status']);
  const row2 = [...row1]; row2[0] = 'SYN-002';
  const report = parseWorkbook(workbook([headers.concat(['Department', 'Status']), row1, row2]));
  assert.equal(report.valid, true);
  for (const code of ['UNRESOLVED_DEPARTMENT', 'UNMAPPED_STATUS', 'POSSIBLE_DUPLICATE', 'TEMPLATE_UNMATCHED']) assert.ok(report.issues.some(i => i.code === code));
  assert.equal(report.rows[0].asset.departmentId, undefined);
});
