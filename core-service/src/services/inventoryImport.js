// Offline preview only. Do not import models, app configuration, or network clients here.
const fields = {
  'Tag #': 'ctrlNumber', Manufacturer: 'manufacturer', Model: 'model',
  'Model Number': 'modelNumber', Description: 'description', 'Serial Number': 'serialNumber',
  Department: 'departmentName', Location: 'locationNote', 'Parent Asset Tag': 'parentAssetTag',
  'Date Acquired': 'acquisitionDate', Status: 'status', 'Purchase Cost': 'reportedPurchaseCost',
  'EQ Class': 'equipmentClass', 'EQ Class Group': 'equipmentClassGroup',
  'Risk Level': 'sourceRiskLevel', 'Risk Name': 'sourceRiskName',
  'FDA Validated': 'sourceFDAValidated', 'FDA Unique Device Identifier': 'fdaUDI',
  'FDA Device Identifier': 'fdaDI', 'Misc Note': 'notes',
  'Proc(Freq)(NDue)': 'sourceMaintenance',
};
const required = ['Tag #', 'Manufacturer', 'Model'];
const identifiers = new Set(['ctrlNumber', 'serialNumber', 'parentAssetTag', 'fdaUDI', 'fdaDI']);

function dateOnly(cell, date1904) {
  if (cell.t === 'n') {
    const serial = cell.v;
    // Excel's fictitious 1900-02-29 must never become a real acquisition date.
    if (!Number.isInteger(serial) || serial < (date1904 ? 0 : 1) || (!date1904 && serial === 60)) return null;
    const epoch = Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31);
    const date = new Date(epoch + (serial - (!date1904 && serial > 60 ? 1 : 0)) * 86400000);
    return Number.isFinite(date.getTime()) && date.getUTCFullYear() <= 9999 ? date.toISOString().slice(0, 10) : null;
  }
  // Ambiguous locale-specific text dates require review, never a guessed conversion.
  const value = String(cell.v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function parseWorkbook(workbook, { sheetName } = {}) {
  const XLSX = require('xlsx');
  const issues = [];
  const rows = [];
  const issue = (severity, code, row, column, message) => issues.push({ severity, code, row, column, message });
  const names = workbook.SheetNames || [];
  const selected = sheetName || (names.length === 1 ? names[0] : null);
  if (!selected || !workbook.Sheets?.[selected]) {
    issue('error', 'SHEET_SELECTION', null, null, 'Select one existing worksheet explicitly when the workbook has multiple sheets.');
    return { sheetName: selected, rows, issues, valid: false };
  }
  const sheet = workbook.Sheets[selected];
  if (!sheet['!ref']) {
    issue('error', 'EMPTY_SHEET', null, null, 'Worksheet is empty.');
    return { sheetName: selected, rows, issues, valid: false };
  }
  const range = XLSX.utils.decode_range(sheet['!ref']);
  if (range.e.r > 100000 || range.e.c > 255) throw new Error('Worksheet exceeds preview limits (100000 rows, 256 columns).');
  const headers = [];
  const seen = new Set();
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })];
    const label = cell?.v == null ? '' : String(cell.v).trim();
    if (cell?.f || (cell?.v != null && typeof cell.v !== 'string')) issue('error', 'INVALID_HEADER', range.s.r + 1, col + 1, 'Headers must be literal text.');
    if (seen.has(label) && label) issue('error', 'DUPLICATE_HEADER', range.s.r + 1, col + 1, `Duplicate header: ${label}`);
    seen.add(label);
    const field = Object.hasOwn(fields, label) ? fields[label] : null;
    headers.push({ col, label, field });
    if (!field && label) issue('warning', 'UNKNOWN_COLUMN', range.s.r + 1, col + 1, `Unmapped column retained in source: ${label}`);
  }
  for (const label of required) if (!seen.has(label)) issue('error', 'MISSING_COLUMN', range.s.r + 1, label, `Required column: ${label}`);
  const tags = new Map();
  const serials = new Map();
  const date1904 = [true, 1, '1', 'true'].includes(workbook.Workbook?.WBProps?.date1904);
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cells = headers.map(h => ({ ...h, cell: sheet[XLSX.utils.encode_cell({ r, c: h.col })] }));
    if (!cells.some(({ cell }) => cell?.f || (cell?.v != null && cell.v !== ''))) continue;
    const record = { row: r + 1, source: [], asset: { templateId: null, verifiedPurchasePrice: null } };
    for (const { col, label, field, cell } of cells) {
      record.source.push({ column: col + 1, header: label, type: cell?.t ?? null, value: cell?.v ?? null, numberFormat: cell?.z ?? null, formula: cell?.f ?? null });
      if (!cell || (cell.v == null && !cell.f)) continue;
      if (cell.f || cell.t === 'e') {
        issue('error', cell.f ? 'FORMULA_CELL' : 'ERROR_CELL', r + 1, label, 'Literal source values are required; cached formula results are not trusted.');
        continue;
      }
      if (!field || cell.v === '') continue;
      if (field === 'acquisitionDate') {
        record.asset[field] = dateOnly(cell, date1904);
        if (!record.asset[field]) issue('error', 'INVALID_DATE', r + 1, label, 'Use an Excel whole-day date or valid ISO date (YYYY-MM-DD).');
      } else if (field === 'reportedPurchaseCost') {
        const value = cell.v;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) issue('error', 'INVALID_COST', r + 1, label, 'Purchase cost must be a nonnegative numeric value.');
        else {
          record.asset[field] = value;
          issue('warning', value === 0 ? 'ZERO_COST' : 'UNVERIFIED_COST', r + 1, label, 'Reported cost retained separately; verified purchase price remains unset.');
        }
      } else {
        if (!['s', 'str', 'n'].includes(cell.t)) {
          issue('error', 'INVALID_TEXT', r + 1, label, 'Expected literal text or a numeric identifier.');
          continue;
        }
        record.asset[field] = String(cell.v);
        if (identifiers.has(field) && cell.t === 'n') {
          // A numeric cell cannot prove original leading zeros or long identifier digits.
          issue('error', 'NUMERIC_IDENTIFIER', r + 1, label, 'Identifier stored as a number: re-export as text to confirm all digits and leading zeros.');
        }
      }
    }
    for (const label of required) if (!record.asset[fields[label]]?.trim()) issue('error', 'REQUIRED_VALUE', r + 1, label, `Required value: ${label}`);
    const tag = record.asset.ctrlNumber?.trim();
    if (tag) {
      if (tags.has(tag)) issue('error', 'DUPLICATE_TAG', r + 1, 'Tag #', `Tag repeats worksheet row ${tags.get(tag)}.`);
      else tags.set(tag, r + 1);
    }
    const serial = record.asset.serialNumber?.trim();
    if (serial) {
      const key = `${record.asset.manufacturer?.trim().toLowerCase()}\u0000${serial.toLowerCase()}`;
      if (serials.has(key)) issue('warning', 'POSSIBLE_DUPLICATE', r + 1, 'Serial Number', `Manufacturer and serial repeat worksheet row ${serials.get(key)}; review required.`);
      else serials.set(key, r + 1);
    } else issue('warning', 'MISSING_SERIAL', r + 1, 'Serial Number', 'Serial number is missing.');
    if (record.asset.status && !['Active', 'Inactive', 'Pending', 'Retired'].includes(record.asset.status)) issue('warning', 'UNMAPPED_STATUS', r + 1, 'Status', 'Source status requires mapping before persistence.');
    if (record.asset.departmentName) issue('warning', 'UNRESOLVED_DEPARTMENT', r + 1, 'Department', 'Department name is retained; facility-scoped resolution is deferred.');
    issue('warning', 'TEMPLATE_UNMATCHED', r + 1, null, 'No template matching performed; missing templates do not block validation.');
    rows.push(record);
  }
  if (!rows.length) issue('error', 'NO_ASSETS', null, null, 'No asset rows found.');
  return { sheetName: selected, rows, issues, valid: !issues.some(i => i.severity === 'error'), scope: 'offline-only; existing assets and references have not been checked' };
}

function parseExcel(buffer, options) {
  if (!Buffer.isBuffer(buffer) || buffer.length > 20 * 1024 * 1024) throw new Error('Supply an Excel buffer no larger than 20 MiB.');
  if (buffer.subarray(0, 4).toString('hex') !== '504b0304') throw new Error('Expected an XLSX workbook (ZIP container).');
  const XLSX = require('xlsx');
  // SheetJS decorates its input buffer with reader helpers; isolate that mutation.
  return parseWorkbook(XLSX.read(Buffer.from(buffer), { type: 'buffer', cellDates: false, cellNF: true, cellFormula: true }), options);
}

module.exports = { parseExcel, parseWorkbook };
