const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const XLSX = require('xlsx');
const { parseWorkbook } = require('../inventoryImport');
const { buildImportPlan } = require('../inventoryImportPlan');
const { prepareAssetCreation, runAssetCreation } = require('../assetCreation');
// Only construct/validate documents. No init, save, create, connection, or real DB.
const Asset = require('../../models/Asset');
const { assetCreateFields, assetEditFields, object: validateBody } = require('../operationalOwnership');
const oid = n => n.toString(16).padStart(24, '0');
const facilityId = oid(1);

function fixture() {
  const headers = ['Tag #', 'Manufacturer', 'Model', 'Model Number', 'Description', 'Serial Number', 'Department', 'Location', 'Parent Asset Tag', 'Date Acquired', 'Status', 'Proc(Freq)(NDue)', 'Purchase Cost', 'EQ Class', 'EQ Class Group', 'Risk Level', 'Risk Name', 'FDA Validated', 'FDA Unique Device Identifier', 'FDA Device Identifier', 'Misc Note'];
  const data = [1, 2, 3].map(n => [`SYN-00${n}`, 'Synthetic Maker', `Family ${n}`, `Family ${n} Q8`, 'Description with trailing space ', `00000${n}`, `Source Dept ${n}`, 'Room A', '', 45000 + n, 'Active', 'Source PM text', 0, 'Source Class', 'Source Group', 'Medium', 'Class 2', 'Yes', `00000000000000000000000${n}`, `0000000000000${n}`, 'Original note']);
  const workbook = { SheetNames: ['Assets'], Sheets: { Assets: XLSX.utils.aoa_to_sheet([headers, ...data]) } };
  const report = parseWorkbook(workbook);
  const snapshot = { id: 'synthetic-snapshot', capturedAt: '2026-11-14T00:00:00Z', assetsScope: 'global', assets: [], departments: [1, 2, 3].map(n => ({ _id: oid(n + 10), facilityId, name: `Short Dept ${n}` })), templates: [{ _id: oid(20), manufacturer: 'Synthetic Maker', model: 'Family 1 Q8', di: '00000000000001' }] };
  const mappings = [1, 2, 3].map(n => ({ facilityId, sourceName: `Source Dept ${n}`, targetName: `Short Dept ${n}` }));
  const importPlan = buildImportPlan(report, { facilityId, snapshot, departmentMappings: mappings });
  importPlan.sheetName = 'Assets';
  const prepared = prepareAssetCreation(importPlan);
  const records = new Map(), calls = [];
  const encode = doc => JSON.parse(JSON.stringify(doc));
  const api = {
    async getReferenceSnapshot() {
      calls.push('references');
      const fresh = structuredClone(snapshot);
      fresh.assets = [...records.values()].map(doc => ({ _id: String(doc._id), facilityId, ctrlNumber: doc.ctrlNumber, manufacturer: doc.manufacturer, serialNumber: doc.serialNumber }));
      return fresh;
    },
    async createAsset(selected, body) {
      assert.equal(selected, facilityId); validateBody(body);
      calls.push(`create:${body.ctrlNumber}`);
      const doc = new Asset({ ...body, facilityId, _id: oid(100 + records.size) });
      assert.equal(doc.validateSync(), undefined);
      records.set(String(doc._id), doc);
      return { asset: encode(doc) };
    },
    async updateAsset(selected, id, body) {
      assert.equal(selected, facilityId); validateBody(body);
      calls.push(`update:${id}`);
      const doc = records.get(id); doc.set(body); assert.equal(doc.validateSync(), undefined);
      return { asset: encode(doc) };
    },
    async getAsset(selected, id) {
      assert.equal(selected, facilityId); calls.push(`read:${id}`);
      const result = encode(records.get(id).toObject({ flattenMaps: true }));
      if (result.templateId) result.templateId = { _id: result.templateId, model: 'Populated synthetic template' };
      return result;
    },
  };
  return { report, snapshot, importPlan, prepared, api, records, calls };
}
const execute = f => runAssetCreation(f.prepared, { execute: true, confirmFacilityId: facilityId, api: f.api });

test('preparation preserves all 21 original cells, model fields and identifiers without mutating inputs', () => {
  const f = fixture(), before = structuredClone(f.importPlan);
  const plan = prepareAssetCreation(f.importPlan);
  assert.deepEqual(f.importPlan, before);
  plan.items.forEach((item, i) => {
    const source = item.create.attributes.truAssetImport;
    assert.equal(source.cells.length, 21);
    assert.deepEqual(source.cells, f.report.rows[i].source);
    assert.equal(source.originalModel, `Family ${i + 1}`);
    assert.equal(source.originalModelNumber, `Family ${i + 1} Q8`);
    assert.equal(item.create.model, source.originalModel);
    assert.equal(item.create.serialNumber, `00000${i + 1}`);
    assert.equal(source.sourceDepartmentName, `Source Dept ${i + 1}`);
    assert.equal(source.reportedPurchaseCost, 0);
    assert.equal(source.verifiedPurchasePrice, null);
    assert.equal(source.sheetName, 'Assets');
    assert.match(source.importKey, /^[a-f\d]{64}$/);
  });
});

test('payloads fit current API allowlists and keep operational purchase values absent', () => {
  const f = fixture();
  for (const item of f.prepared.items) {
    assert.ok(Object.keys(item.create).every(k => assetCreateFields.includes(k)));
    assert.ok(Object.keys(item.followUp).every(k => assetEditFields.includes(k)));
    assert.equal(item.create.acquisitionDate, undefined);
    assert.match(item.followUp.acquisitionDate, /^\d{4}-\d{2}-\d{2}$/);
    for (const key of ['purchase', 'purchaseCost', 'purchaseDate', 'installationDate', 'serviceStartDate', 'riskLevel']) {
      assert.equal(item.create[key], undefined); assert.equal(item.followUp[key], undefined);
    }
    assert.deepEqual(item.create.maintenanceSchedule, {});
  }
  assert.equal(f.prepared.items[0].create.templateId, oid(20));
  assert.equal(f.prepared.items[1].create.templateId, null);
  assert.equal(f.prepared.items[2].create.templateId, null);
});

test('preview never calls an API, even when one is provided', async () => {
  const f = fixture();
  const api = new Proxy({}, { get() { throw new Error('Network forbidden in preview'); } });
  const result = await runAssetCreation(f.prepared, { api });
  assert.equal(result.executed, false); assert.equal(result.requests.length, 3);
  assert.ok(result.requests.every(r => r.create.headers['x-facility-id'] === facilityId));
  assert.equal(f.records.size, 0);
});

test('unresolved plans, nonblank costs, invalid dates and edited payloads are rejected', async () => {
  const f = fixture();
  for (const change of [{ disposition: 'review' }, { proposed: { ...f.importPlan.rows[0].proposed, verifiedPurchasePrice: 0 } }, { proposed: { ...f.importPlan.rows[0].proposed, departmentId: null } }, { proposed: { ...f.importPlan.rows[0].proposed, acquisitionDate: '2025-02-29' } }, { proposed: { ...f.importPlan.rows[0].proposed, status: 'Unknown' } }]) {
    const p = structuredClone(f.importPlan); Object.assign(p.rows[0], change);
    assert.throws(() => prepareAssetCreation(p));
  }
  const changed = structuredClone(f.prepared); changed.items[0].create.purchase = { price: 0 };
  await assert.rejects(runAssetCreation(changed), /changed/);
  await assert.rejects(runAssetCreation(f.prepared, { execute: true, confirmFacilityId: oid(2), api: f.api }));
  assert.equal(f.records.size, 0);
});

test('complete synthetic workflow validates real schemas, writes metadata in a second stage and reads back all source', async () => {
  const f = fixture(), before = structuredClone(f.prepared);
  const result = await execute(f);
  assert.equal(result.status, 'completed'); assert.equal(result.results.length, 3);
  assert.equal(f.records.size, 3);
  for (const [i, doc] of [...f.records.values()].entries()) {
    const asset = JSON.parse(JSON.stringify(doc));
    assert.deepEqual(asset.attributes.truAssetImport.cells, f.report.rows[i].source);
    assert.equal(asset.purchase, null); assert.equal(asset.purchaseCost, undefined);
    assert.equal(asset.acquisitionDate.slice(0, 10), f.prepared.items[i].followUp.acquisitionDate);
    assert.equal(asset.equipmentClass, 'Source Class');
    assert.equal(asset.maintenanceSchedule?.intervalMonths, undefined);
  }
  assert.equal(f.calls[0], 'references');
  assert.deepEqual(f.calls.slice(1).map(c => c.split(':')[0]), ['create', 'update', 'read', 'create', 'update', 'read', 'create', 'update', 'read']);
  assert.deepEqual(f.prepared, before);
});

test('fresh duplicate tags block repeat execution without overwriting records', async () => {
  const f = fixture(); await execute(f); const count = f.calls.length;
  await assert.rejects(execute(f), /reference checks/);
  assert.deepEqual(f.calls.slice(count), ['references']); assert.equal(f.records.size, 3);
});

test('global tag, manufacturer/serial and changed department/template matches stop preflight', async () => {
  for (const modify of [
    s => s.assets.push({ _id: oid(50), facilityId: oid(2), ctrlNumber: 'SYN-001', manufacturer: 'Other' }),
    s => s.assets.push({ _id: oid(50), facilityId: oid(2), ctrlNumber: 'OTHER', manufacturer: 'Synthetic Maker', serialNumber: '000001' }),
    s => { s.departments[0]._id = oid(99); },
    s => { s.templates[0].status = 'Archived'; },
    s => { s.assetsScope = 'facility'; },
  ]) {
    const f = fixture(); f.api.getReferenceSnapshot = async () => { const s = structuredClone(f.snapshot); modify(s); return s; };
    await assert.rejects(execute(f)); assert.equal(f.records.size, 0); assert.equal(f.calls.length, 0);
  }
});

test('preflight transport errors are sanitized and send no creation requests', async () => {
  const f = fixture(); f.api.getReferenceSnapshot = async () => { throw new Error('private-token'); };
  await assert.rejects(execute(f), error => !error.message.includes('private-token') && error.message.includes('no creation'));
  assert.equal(f.records.size, 0);
});

test('uncertain create stops without retries or proceeding to another asset', async () => {
  const f = fixture(); let attempts = 0;
  f.api.createAsset = async () => { attempts++; throw new Error('private-response'); };
  const result = await execute(f);
  assert.equal(attempts, 1);
  assert.deepEqual(result.results.map(r => r.status), ['reconciliation-required', 'not-attempted', 'not-attempted']);
  assert.equal(result.results[0].stage, 'create');
  assert.equal(JSON.stringify(result).includes('private-response'), false);
});

test('a duplicate advisory after creation stops before metadata update', async () => {
  const f = fixture(), create = f.api.createAsset;
  f.api.createAsset = async (...args) => ({ ...(await create(...args)), warning: 'Potential duplicate' });
  const result = await execute(f);
  assert.equal(result.status, 'reconciliation-required'); assert.equal(f.records.size, 1);
  assert.equal(f.calls.some(c => c.startsWith('update:')), false);
  assert.equal(result.results[0].assetId, oid(100));
});

test('metadata update failure records created ID and stops without retry, rollback or next asset', async () => {
  const f = fixture(); f.api.updateAsset = async () => { throw new Error('simulated timeout after write'); };
  const result = await execute(f);
  assert.equal(result.status, 'reconciliation-required'); assert.equal(result.results[0].stage, 'follow-up');
  assert.equal(result.results[0].assetId, oid(100)); assert.equal(f.records.size, 1);
  assert.equal(f.calls.some(c => c.startsWith('read:')), false);
});

for (const method of ['updateAsset', 'getAsset']) test(`${method} rejects a different returned asset ID and retains the created ID for reconciliation`, async () => {
  const f = fixture(), original = f.api[method];
  f.api[method] = async (...args) => {
    const response = await original(...args);
    const asset = response.asset ?? response;
    asset._id = oid(999);
    return response;
  };
  const result = await execute(f);
  assert.equal(result.status, 'reconciliation-required');
  assert.deepEqual(result.results.map(r => r.status), ['reconciliation-required', 'not-attempted', 'not-attempted']);
  assert.equal(result.results[0].assetId, oid(100));
  assert.equal(result.results[0].stage, method === 'updateAsset' ? 'follow-up' : 'read-back');
  assert.equal(f.records.size, 1);
  assert.equal(f.calls.filter(c => c.startsWith('create:')).length, 1);
  assert.equal(f.calls.filter(c => c.startsWith('update:')).length, 1);
  assert.equal(f.calls.filter(c => c.startsWith('read:')).length, method === 'updateAsset' ? 0 : 1);
});

for (const field of ['installationDate', 'serviceStartDate']) {
  for (const method of ['createAsset', 'updateAsset', 'getAsset']) test(`${method} rejects an unexpected ${field} without continuing or retrying`, async () => {
    const f = fixture(), original = f.api[method];
    f.api[method] = async (...args) => {
      const response = await original(...args);
      const asset = response.asset ?? response;
      asset[field] = '2026-01-01T00:00:00.000Z';
      return response;
    };
    const result = await execute(f);
    assert.equal(result.status, 'reconciliation-required');
    assert.deepEqual(result.results.map(r => r.status), ['reconciliation-required', 'not-attempted', 'not-attempted']);
    assert.equal(result.results[0].assetId, oid(100));
    assert.equal(result.results[0].stage, { createAsset: 'create', updateAsset: 'follow-up', getAsset: 'read-back' }[method]);
    assert.equal(f.records.size, 1);
    assert.equal(f.calls.filter(c => c.startsWith('create:')).length, 1);
    assert.equal(f.calls.filter(c => c.startsWith('update:')).length, method === 'createAsset' ? 0 : 1);
    assert.equal(f.calls.filter(c => c.startsWith('read:')).length, method === 'getAsset' ? 1 : 0);
  });
}

test('explicitly null service dates remain acceptable in all response stages', async () => {
  const f = fixture();
  for (const method of ['createAsset', 'updateAsset', 'getAsset']) {
    const original = f.api[method];
    f.api[method] = async (...args) => {
      const response = await original(...args), asset = response.asset ?? response;
      asset.installationDate = null;
      asset.serviceStartDate = null;
      return response;
    };
  }
  const result = await execute(f);
  assert.equal(result.status, 'completed');
  assert.equal(result.results.length, 3);
});

test('missing provenance or populated verified cost in create/read-back response requires reconciliation', async () => {
  for (const stage of ['createAsset', 'getAsset']) for (const change of ['source', 'cost']) {
    const f = fixture(), original = f.api[stage];
    f.api[stage] = async (...args) => {
      const response = await original(...args), asset = response.asset ?? response;
      if (change === 'source') asset.attributes = {};
      else asset.purchase = { price: 0 };
      return response;
    };
    const result = await execute(f);
    assert.equal(result.status, 'reconciliation-required'); assert.equal(f.records.size, 1);
  }
});

test('asset detail transport preserves Map source data and template attributes do not replace the source namespace', async () => {
  const f = fixture(), body = f.prepared.items[0].create;
  const doc = new Asset({ ...body, facilityId, attributes: { ...body.attributes, di: 'TEMPLATE-DI' } });
  const dto = JSON.parse(JSON.stringify(doc.toObject({ flattenMaps: true })));
  assert.deepEqual(dto.attributes.truAssetImport, body.attributes.truAssetImport);
  assert.equal(dto.attributes.di, 'TEMPLATE-DI');
  const query = { populate() { return this; }, then(resolve, reject) { return Promise.resolve(doc).then(resolve, reject); } };
  const router = loadAssetRouter({ Asset: { findOne: () => query } });
  const handler = router.stack.find(layer => layer.route?.path === '/:id' && layer.route.methods.get).route.stack.at(-1).handle;
  let response, status;
  await handler({ params: { id: String(doc._id) } }, { status(code) { status = code; return this; }, json(value) { response = JSON.parse(JSON.stringify(value)); } });
  assert.equal(status, 200);
  assert.deepEqual(response.attributes.truAssetImport, body.attributes.truAssetImport);
});

function loadAssetRouter({ Asset: assetModel, Template = {} }) {
  const vm = require('node:vm'), { createRequire } = require('node:module');
  const file = path.resolve(__dirname, '../../routers/assetsRouter.js');
  const realRequire = createRequire(file);
  const ownership = require('../operationalOwnership');
  const overrides = {
    '../services/operationalOwnership': { ...ownership, selectedFacility: async () => facilityId, visibility: () => ({ facilityId }), assetReferences: async (body, selected) => { assert.equal(selected, facilityId); assert.ok(validIdForTest(body.departmentId)); } },
    '../services/templateLifecycle': { withReference: async (id, operation, destination, write) => write() },
    '../models/Asset': assetModel, '../models/EquipmentTemplate.js': Template,
    '../models/WorkOrder': { find: () => ({ select() { return this; }, async lean() { return []; } }) },
    '../middleware/authMiddleware': { authenticateToken(req, res, next) { next(); }, authorizeRoles: () => (req, res, next) => next() },
    '../middleware/tenantScope': { buildTenantFilter: () => ({ facilityId }) },
    './workOrderRouter': require('express').Router(),
    '../services/assetLifecycleAssessment': { isLifecycleDate: () => true },
    '../utils/lifecycleBenchmark': { computeBenchmarkComparison: () => ({}) },
  };
  const module = { exports: {} };
  const wrapper = vm.runInThisContext(`(function(require,module,exports,console){${fs.readFileSync(file, 'utf8')}\n})`, { filename: file });
  const rejectLog = () => { throw new Error('Creation payload must not be logged'); };
  wrapper(name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.includes('models/')) throw new Error('Unmocked database model forbidden');
    return realRequire(name);
  }, module, module.exports, { log: rejectLog, dir: rejectLog, error: rejectLog });
  return module.exports;
}
const validIdForTest = value => /^[a-f\d]{24}$/.test(value);

test('actual POST handler preserves source through template defaults, leaves costs blank, and emits no source logs', async () => {
  const f = fixture(), item = f.prepared.items[0];
  let written;
  const router = loadAssetRouter({
    Asset: {
      async findOne() { return null; },
      async create(payload) { const doc = new Asset(payload); assert.equal(doc.validateSync(), undefined); written = doc; return doc; },
    },
    Template: { findById: () => ({ async lean() { return { _id: oid(20), manufacturer: 'Template Maker', model: 'Template Model', di: 'TEMPLATE-DI', manufacturerRecommendedPMFrequency: 12, lineItemPricing: 9999 }; } }) },
  });
  const handler = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.post).route.stack.at(-1).handle;
  let status, response;
  await handler({ body: structuredClone(item.create), user: { id: oid(90), role: 'admin' } }, { status(code) { status = code; return this; }, json(value) { response = JSON.parse(JSON.stringify(value)); } });
  assert.equal(status, 201, JSON.stringify(response));
  assert.equal(response.asset.model, item.create.model);
  assert.deepEqual(response.asset.attributes.truAssetImport, item.create.attributes.truAssetImport);
  assert.equal(response.asset.purchase, null);
  assert.equal(response.asset.purchaseCost, undefined);
  assert.equal(response.asset.maintenanceSchedule?.intervalMonths, undefined);
  assert.equal(response.asset.attributes.di, 'TEMPLATE-DI');
  assert.ok(written);
});

test('offline CLI outputs a preview and rejects execution flags without touching inputs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cronus-asset-preview-'));
  const file = path.join(dir, 'synthetic-plan.json');
  try {
    const content = JSON.stringify(fixture().importPlan); fs.writeFileSync(file, content);
    const script = path.resolve(__dirname, '../../../scripts/prepareAssetCreation.cjs');
    let result = spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).preview.executed, false);
    result = spawnSync(process.execPath, [script, file, '--execute'], { encoding: 'utf8' });
    assert.equal(result.status, 2); assert.equal(fs.readFileSync(file, 'utf8'), content);
  } finally { fs.unlinkSync(file); fs.rmdirSync(dir); }
});
