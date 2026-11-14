const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matchingModelLabel, buildImportPlan } = require('../inventoryImportPlan');
const { parseWorkbook } = require('../inventoryImport');
const XLSX = require('xlsx');
const oid = n => n.toString(16).padStart(24, '0');
const facilityId = oid(1), otherFacility = oid(2);
const snapshot = () => ({ id: 'synthetic-1', capturedAt: '2026-11-14T12:00:00Z', assetsScope: 'global', assets: [], departments: [], templates: [] });
const report = (patch = {}) => ({ valid: true, issues: [], rows: [{ row: 2, source: [{ value: 'unchanged' }], asset: { ctrlNumber: 'SYN-001', manufacturer: 'Synthetic Maker', model: 'Family', modelNumber: 'P8', serialNumber: '000964', reportedPurchaseCost: 0, ...patch } }] });
const plan = (r = report(), s = snapshot()) => buildImportPlan(r, { facilityId, snapshot: s });
const codes = p => p.issues.map(i => i.code);
const existing = patch => ({ _id: oid(10), facilityId, ctrlNumber: 'EXISTING', manufacturer: 'Synthetic Maker', serialNumber: 'other', ...patch });
const template = patch => ({ _id: oid(20), manufacturer: 'Synthetic Maker', model: 'Family P8', ...patch });

test('matching labels combine family and number, avoid repeating full model, and preserve originals', () => {
  for (const [model, modelNumber, expected] of [['Family', 'P8', 'Family P8'], ['Family', 'Family', 'Family'], ['Family', 'Family P8', 'Family P8'], ['Family FD', 'Family FD20', 'Family FD20'], ['Family', '', 'Family']]) {
    const a = { model, modelNumber }; const before = structuredClone(a);
    assert.equal(matchingModelLabel(a), expected); assert.deepEqual(a, before);
  }
});

test('no snapshot leaves checks pending, never treats absent collections as empty', () => {
  const p = buildImportPlan(report(), { facilityId });
  assert.equal(p.rows[0].disposition, 'review');
  assert.equal(p.rows[0].resolution.duplicateCheck, 'not-checked');
  assert.ok(codes(p).includes('SNAPSHOT_REQUIRED'));
  assert.equal(p.readyToImport, false);
});

test('validates explicit facility, snapshot completeness, metadata, record IDs and text identifiers', () => {
  assert.throws(() => buildImportPlan(report(), {}), /facilityId/);
  for (const change of [{ assetsScope: 'facility' }, { assets: undefined }, { templates: undefined }, { capturedAt: 'bad' }, { assets: [existing({ serialNumber: 964 })] }, { departments: [{ _id: oid(3), name: 'Dept' }] }, { templates: [template({ _id: 'bad' })] }, { templates: [template(), template()] }]) {
    assert.throws(() => plan(report(), { ...snapshot(), ...change }));
  }
});

test('department resolution stays in the selected facility and requires one normalized exact name', () => {
  const s = snapshot(); s.departments = [{ _id: oid(3), facilityId: otherFacility, name: 'Imaging' }];
  let p = plan(report({ departmentName: ' Imaging ' }), s);
  assert.equal(p.rows[0].disposition, 'review'); assert.equal(p.rows[0].proposed.departmentId, undefined);
  s.departments.push({ _id: oid(4), facilityId, name: 'IMAGING' });
  p = plan(report({ departmentName: ' Imaging ' }), s);
  assert.equal(p.rows[0].proposed.departmentId, oid(4));
  s.departments.push({ _id: oid(5), facilityId, name: 'imaging' });
  assert.equal(plan(report({ departmentName: 'Imaging' }), s).rows[0].proposed.departmentId, undefined);
});

test('existing tags block globally including archived assets without exposing cross-facility data', () => {
  const s = snapshot(); s.assets = [existing({ facilityId: otherFacility, ctrlNumber: 'SYN-001', isArchived: true })];
  const p = plan(report(), s);
  assert.equal(p.rows[0].disposition, 'blocked'); assert.ok(codes(p).includes('EXISTING_TAG'));
  assert.equal(JSON.stringify(p).includes(oid(10)), false);
});

test('manufacturer/serial duplicates require review; other manufacturers receive a warning', () => {
  const s = snapshot(); s.assets = [existing({ serialNumber: '000964' })];
  assert.equal(plan(report(), s).rows[0].disposition, 'review');
  s.assets[0].manufacturer = 'Other Maker';
  const p = plan(report(), s);
  assert.ok(codes(p).includes('EXISTING_SERIAL_OTHER_MANUFACTURER'));
  assert.equal(p.rows[0].disposition, 'proposed-create');
});

test('template matching uses the approved label, preserves source models and never fills costs', () => {
  const s = snapshot(); s.templates = [template({ lineItemPricing: 9000 })];
  const r = report({ verifiedPurchasePrice: 123 }); const before = structuredClone({ r, s });
  const p = plan(r, s);
  assert.equal(p.rows[0].matchingModelLabel, 'Family P8');
  assert.equal(p.rows[0].proposed.templateId, oid(20));
  assert.equal(p.rows[0].proposed.model, 'Family');
  assert.equal(p.rows[0].proposed.modelNumber, 'P8');
  assert.equal(p.rows[0].proposed.verifiedPurchasePrice, null);
  assert.deepEqual({ r, s }, before);
});

test('missing and archived templates are allowed and cannot supply a reference', () => {
  for (const flags of [{ status: 'Archived' }, { deletedAt: '2026-01-01' }, { isArchived: false }, { archivedBy: oid(8) }]) {
    const s = snapshot(); s.templates = [template(flags)];
    const p = plan(report(), s);
    assert.equal(p.rows[0].proposed.templateId, null);
    assert.equal(p.rows[0].disposition, 'proposed-create');
    assert.ok(codes(p).includes('TEMPLATE_UNMATCHED'));
  }
});

test('template ambiguity, conflicting DI, or DI-only evidence require review', () => {
  const combinations = [
    [template(), template({ _id: oid(21) })],
    [template({ di: '00123' })],
    [template({ model: 'Different', di: '00999' })],
    [template({ di: '00123' }), template({ _id: oid(21), model: 'Different', di: '00999' })],
  ];
  for (const templates of combinations) {
    const s = { ...snapshot(), templates };
    const p = plan(report({ fdaDI: '00999' }), s);
    assert.equal(p.rows[0].proposed.templateId, null);
    assert.ok(codes(p).includes('TEMPLATE_REVIEW'));
  }
  const s = { ...snapshot(), templates: [template({ di: '00999' })] };
  assert.equal(plan(report({ fdaDI: '00999' }), s).rows[0].proposed.templateId, oid(20));
});

test('parents resolve only to existing same-facility assets, self-parent is blocked', () => {
  const s = snapshot(); s.assets = [existing({ facilityId: otherFacility })];
  let p = plan(report({ parentAssetTag: 'EXISTING' }), s);
  assert.equal(p.rows[0].disposition, 'review'); assert.equal(p.rows[0].proposed.parentAsset, undefined);
  s.assets[0].facilityId = facilityId;
  p = plan(report({ parentAssetTag: 'EXISTING' }), s);
  assert.equal(p.rows[0].proposed.parentAsset, oid(10));
  assert.equal(plan(report({ parentAssetTag: 'SYN-001' }), s).rows[0].disposition, 'blocked');
});

test('parser errors block, statuses and workbook duplicate serials require review', () => {
  const r = report(); r.valid = false; r.issues = [{ severity: 'error', code: 'HEADER_ERROR', row: 1 }];
  // A header error applies to every row, not just an asset at that row number.
  assert.equal(plan(r).rows[0].disposition, 'blocked');
  assert.equal(plan(report({ status: 'Source Status' })).rows[0].disposition, 'review');
  const two = report(); two.rows.push({ ...structuredClone(two.rows[0]), row: 3 });
  assert.ok(codes(plan(two)).includes('DUPLICATE_PLAN_TAG'));
  two.rows[1].asset.ctrlNumber = 'SYN-002';
  assert.ok(codes(plan(two)).includes('WORKBOOK_MANUFACTURER_SERIAL'));
});

test('parser integration replaces deferred warnings only when checks ran', () => {
  const sheet = XLSX.utils.aoa_to_sheet([['Tag #', 'Manufacturer', 'Model', 'Model Number', 'Department', 'Purchase Cost'], ['SYN-001', 'Synthetic Maker', 'Family', 'P8', 'Imaging', 0]]);
  const r = parseWorkbook({ SheetNames: ['Assets'], Sheets: { Assets: sheet } });
  const s = snapshot(); s.departments = [{ _id: oid(3), facilityId, name: 'Imaging' }]; s.templates = [template()];
  const p = plan(r, s);
  assert.equal(p.rows[0].disposition, 'proposed-create');
  assert.ok(codes(p).includes('ZERO_COST'));
  assert.equal(codes(p).includes('UNRESOLVED_DEPARTMENT'), false);
  assert.equal(codes(p).includes('TEMPLATE_UNMATCHED'), false);
  const pending = buildImportPlan(r, { facilityId });
  assert.ok(codes(pending).includes('UNRESOLVED_DEPARTMENT'));
});

test('planning CLI reads synthetic files without modifying them and reports pending/error exit codes', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cronus-plan-test-'));
  const excelFile = path.join(dir, 'synthetic.xlsx'), snapshotFile = path.join(dir, 'synthetic.json');
  const script = path.resolve(__dirname, '../../../scripts/planInventory.cjs');
  const sheet = XLSX.utils.aoa_to_sheet([['Tag #', 'Manufacturer', 'Model'], ['SYN-001', 'Synthetic Maker', 'Family']]);
  const bytes = XLSX.write({ SheetNames: ['Assets'], Sheets: { Assets: sheet } }, { type: 'buffer', bookType: 'xlsx' });
  const json = JSON.stringify(snapshot());
  try {
    fs.writeFileSync(excelFile, bytes); fs.writeFileSync(snapshotFile, json);
    let result = spawnSync(process.execPath, [script, excelFile, facilityId, snapshotFile], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).readyToImport, false);
    result = spawnSync(process.execPath, [script, excelFile, facilityId, '-'], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).summary.review, 1);
    result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    result = spawnSync(process.execPath, [script, excelFile, 'bad-id', snapshotFile], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.equal(fs.readFileSync(excelFile).equals(bytes), true);
    assert.equal(fs.readFileSync(snapshotFile, 'utf8'), json);
  } finally {
    for (const file of [excelFile, snapshotFile]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});

test('explicit facility-scoped department names preserve original source and propose creation without IDs', () => {
  const r = report({ departmentName: 'SYN-Imaging' }); const before = structuredClone(r);
  const mappings = [{ facilityId, sourceName: 'SYN-Imaging', targetName: 'Imaging' }];
  const p = buildImportPlan(r, { facilityId, snapshot: snapshot(), departmentMappings: mappings });
  assert.equal(p.rows[0].proposed.departmentName, 'Imaging');
  assert.equal(p.rows[0].sourceDepartmentName, 'SYN-Imaging');
  assert.deepEqual(p.rows[0].source, r.rows[0].source);
  assert.equal(p.rows[0].proposed.departmentId, undefined);
  assert.equal(p.rows[0].resolution.department, 'creation-proposed');
  assert.equal(p.rows[0].disposition, 'review');
  assert.equal(p.readyToImport, false);
  assert.deepEqual(p.departmentProposals, [{ facilityId, name: 'Imaging', action: 'propose-create', status: 'pending', departmentId: null, sourceNames: ['SYN-Imaging'], rows: [2] }]);
  assert.deepEqual(r, before);
});

test('mapped names match existing local departments but never create around ambiguous matches', () => {
  const s = snapshot(); s.departments = [{ _id: oid(3), facilityId, name: 'Imaging' }];
  const options = { facilityId, snapshot: s, departmentMappings: [{ facilityId, sourceName: 'SYN-Imaging', targetName: 'Imaging' }] };
  let p = buildImportPlan(report({ departmentName: 'SYN-Imaging' }), options);
  assert.equal(p.rows[0].proposed.departmentId, oid(3));
  assert.equal(p.departmentProposals.length, 0);
  s.departments.push({ _id: oid(4), facilityId, name: 'Imaging' });
  p = buildImportPlan(report({ departmentName: 'SYN-Imaging' }), options);
  assert.equal(p.rows[0].resolution.department, 'ambiguous');
  assert.equal(p.departmentProposals.length, 0);
});

test('department proposals are deduplicated and require explicit mappings and snapshot checks', () => {
  const r = report({ departmentName: 'SYN-Imaging' });
  r.rows.push({ ...structuredClone(r.rows[0]), row: 3, asset: { ...r.rows[0].asset, ctrlNumber: 'SYN-002' } });
  const options = { facilityId, snapshot: snapshot(), departmentMappings: [{ facilityId, sourceName: 'SYN-Imaging', targetName: 'Imaging' }] };
  assert.equal(buildImportPlan(r, options).departmentProposals.length, 1);
  assert.equal(buildImportPlan(r, { ...options, snapshot: null }).departmentProposals.length, 0);
  assert.equal(plan(r).departmentProposals.length, 0);
  for (const mappings of [null, [{ facilityId: otherFacility, sourceName: 'SYN-Imaging', targetName: 'Imaging' }], [{ facilityId, sourceName: 'SYN-Imaging', targetName: '' }], [...options.departmentMappings, ...options.departmentMappings]]) {
    assert.throws(() => buildImportPlan(r, { ...options, departmentMappings: mappings }));
  }
});
