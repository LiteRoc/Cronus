import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

// Permanent facility regressions. Frozen reproduction stays unchanged; lifecycle
// fixtures now use historical snapshots rather than cached Asset maintenance amounts.
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const secret = 'synthetic-facility-reproduction-only-signing-key';
let harness, app, Asset, WorkOrder, Facility, Template;
let a, b, template, assets, orders;
jest.setTimeout(120000);

function headers({ role = 'technician', selected = a, allowed = [a], defaultFacility = a } = {}) {
  return {
    Authorization: `Bearer ${jwt.sign({
      sub: '000000000000000000000001', role,
      ...(defaultFacility ? { facilityId: String(defaultFacility) } : {}), facilities: allowed.map(String),
    }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`,
    'x-facility-id': String(selected),
  };
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = secret;
  process.env.JWT_ISS = 'cronus.api';
  process.env.JWT_AUD = 'cronus.app';
  harness = await createIsolatedMongoHarness(mongoose);
  Asset = requireCore('./src/models/Asset.js');
  WorkOrder = requireCore('./src/models/WorkOrder.js');
  Facility = requireCore('./src/models/Facility.js');
  Template = requireCore('./src/models/EquipmentTemplate.js');
  requireCore('./src/models/User.js');
  app = express();
  app.use(express.json());
  app.use('/assets', requireCore('./src/routers/assetsRouter.js'));
  app.use('/workorders', requireCore('./src/routers/workOrderRouter.js'));
  app.use('/templates', requireCore('./src/routers/templatesRouter.js'));
});

beforeEach(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  a = new mongoose.Types.ObjectId();
  b = new mongoose.Types.ObjectId();
  template = new mongoose.Types.ObjectId();
  // Collection inserts are synthetic fixtures on the guarded ephemeral connection.
  // Stable insertion/request-date ordering makes the foreign pagination row explicit.
  await Facility.collection.insertMany([{ _id: a, name: 'Synthetic A' }, { _id: b, name: 'Synthetic B' }]);
  await Template.collection.insertOne({ _id: template, manufacturer: 'Synthetic', model: 'Pump' });
  assets = [
    { facilityId: a, ctrlNumber: 'needle-A1' },
    { facilityId: b, ctrlNumber: 'needle-B1' },
    { facilityId: a, ctrlNumber: 'needle-A2' },
    { facilityId: b, ctrlNumber: 'needle-B2' },
    { facilityId: a, ctrlNumber: 'other-A' },
  ].map((row, index) => ({
    _id: new mongoose.Types.ObjectId(), templateId: template,
    manufacturer: 'Synthetic', model: 'Pump', serialNumber: `serial-${index}`,
    status: 'Active', metrics: {
      yearsInService: row.facilityId === a ? 1 : 10,
      projectedAnnualMaintenance: row.facilityId === a ? 10 : 100,
      replacementRecommended: row.facilityId === b,
    }, ...row,
  }));
  await Asset.collection.insertMany(assets);
  orders = assets.map((asset, index) => ({
    _id: new mongoose.Types.ObjectId(), assetId: asset._id, facilityId: asset.facilityId,
    description: asset.ctrlNumber, workOrderType: 'Corrective', status: 'Open',
    requestDate: new Date(Date.UTC(2026, 0, 10 - index)),
  }));
  await WorkOrder.collection.insertMany(orders);
});

afterEach(async () => {
  if (harness) {
    for (const model of [Asset, WorkOrder, Facility, Template]) {
      if (model) await model.deleteMany({});
    }
  }
  jest.restoreAllMocks();
});
afterAll(async () => { if (harness) await harness.stop(); });

test('BASELINE: configured and alternate database targets are rejected before connection', async () => {
  const connection = mongoose.connection;
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued by MongoMemoryServer');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/foreign')).rejects.toThrow('not issued by MongoMemoryServer');
  expect(mongoose.connection).toBe(connection);
  expect(connection.readyState).toBe(1);
  expect(await Asset.countDocuments()).toBe(5);
});

for (const target of [
  { path: '/assets', key: 'assets', total: 'totalAssets', search: { search: 'needle' }, filter: { manufacturer: 'Synthetic' } },
  { path: '/workorders', key: 'items', total: 'total', search: { q: 'needle' }, filter: { status: 'Open' } },
]) {
  const rows = () => target.path === '/assets' ? assets : orders;
  const visibleIds = (matching = false) => rows().filter(row => row.facilityId.equals(a)
    && (!matching || String(row.ctrlNumber || row.description).includes('needle'))).map(row => String(row._id)).sort();
  const get = (query = {}, context = {}) => request(app).get(target.path).set(headers(context)).query(query).expect(200);

  test(`BASELINE: ${target.path} requires authentication`, async () => {
    await request(app).get(target.path).expect(401);
  });
  test(`BASELINE: ${target.path} ordinary list and counts exclude B`, async () => {
    const { body } = await get();
    expect(body[target.key].map(row => row._id).sort()).toEqual(visibleIds());
    expect(body[target.total]).toBe(3);
  });
  test(`BASELINE: ${target.path} ordinary pagination excludes B`, async () => {
    const pages = await Promise.all([1, 2, 3].map(page => get({ page, limit: 1 })));
    expect(pages.flatMap(res => res.body[target.key].map(row => row._id)).sort()).toEqual(visibleIds());
    for (const { body } of pages) {
      expect(body[target.total]).toBe(3);
      expect(body.totalPages).toBe(3);
    }
  });
  test(`REGRESSION: ${target.path} search narrows authorized items`, async () => {
    const { body } = await get(target.search);
    expect(body[target.key].map(row => row._id).sort()).toEqual(visibleIds(true));
  });
  test(`REGRESSION: ${target.path} search count excludes B`, async () => {
    const { body } = await get(target.search);
    expect(body[target.total]).toBe(2);
  });
  test(`REGRESSION: ${target.path} search plus supported filter preserves scope`, async () => {
    const { body } = await get({ ...target.search, ...target.filter });
    expect(body[target.key].map(row => row._id).sort()).toEqual(visibleIds(true));
  });
  test(`REGRESSION: ${target.path} search pagination never returns foreign row`, async () => {
    const { body } = await get({ ...target.search, page: 2, limit: 1 });
    expect(body[target.key]).toHaveLength(1);
    expect(visibleIds(true)).toContain(body[target.key][0]._id);
  });
  test(`REGRESSION: ${target.path} search totalPages excludes foreign matches`, async () => {
    const { body } = await get({ ...target.search, page: 1, limit: 1 });
    expect(body.totalPages).toBe(2);
  });
}

test('REGRESSION: customer Asset search preserves A-only authorization', async () => {
  const { body } = await request(app).get('/assets?search=needle').set(headers({ role: 'customer' })).expect(200);
  expect(body.assets.every(row => row.facilityId === String(a))).toBe(true);
});

test('BASELINE: customer cannot list Work Orders', async () => {
  await request(app).get('/workorders?q=needle').set(headers({ role: 'customer' })).expect(403);
});

test('REGRESSION: Work Order analytics search preserves A-only authorization', async () => {
  const { body } = await request(app).get('/workorders?q=needle&mode=analytics').set(headers()).expect(200);
  const allowed = orders.filter(row => row.facilityId.equals(a)).map(row => String(row._id));
  expect(body.items.every(row => allowed.includes(row._id))).toBe(true);
});

test('BASELINE: selected B is authorized for a dual-Facility technician', async () => {
  const { body } = await request(app).get('/assets').set(headers({ selected: b, allowed: [a, b] })).expect(200);
  expect(body.totalAssets).toBe(2);
  expect(body.assets.every(row => row.facilityId === String(b))).toBe(true);
});

async function seedCanonicalLifecycle() {
  const costs=requireCore('./src/services/workOrderCosts/calculate');
  for(const asset of assets) {
    const isA=asset.facilityId.equals(a),rate=isA?10:100;
    const purchaseDate=new Date();purchaseDate.setUTCFullYear(purchaseDate.getUTCFullYear()-(isA?1:10));
    await Asset.collection.updateOne({_id:asset._id},{$set:{purchaseDate,purchaseCost:1000}});
    const row=orders.find(w=>w.assetId.equals(asset._id));
    row.status='Completed';row.completionDate=new Date();row.economics={schemaVersion:1,revision:1,origin:'native'};
    row.timeLogs=[{_id:new mongoose.Types.ObjectId(),timeSpent:60,laborRate:rate,laborCost:rate,pricing:{version:1,basis:'documented',sourceKind:'synthetic',sourceId:'fixture',capturedBy:'synthetic',capturedAt:new Date()}}];
    row.costs=costs.calculate(row);
    await WorkOrder.collection.replaceOne({_id:row._id},row);
  }
  await Template.collection.updateOne({_id:template},{$set:{lifecycleDefaults:{expectedLifeYears:8}}});
}

test('BASELINE: template lifecycle matches A when default and selection agree', async () => {
  await seedCanonicalLifecycle();
  const { body } = await request(app).get(`/templates/${template}/lifecycle`).set(headers()).expect(200);
  expect(body.summary.totalAssets).toBe(3);
  expect(body.summary.averageAnnualMaintenancePerAsset).toBe(10);
  expect(body.benchmarks.tenant.sampleAssets).toBe(3);
});

test('REGRESSION: template lifecycle summary follows authorized selected B instead of default A', async () => {
  await seedCanonicalLifecycle();
  const { body } = await request(app).get(`/templates/${template}/lifecycle`)
    .set(headers({ selected: b, allowed: [a, b] })).expect(200);
  expect(body.summary).toMatchObject({ totalAssets: 2, averageAnnualMaintenancePerAsset: 100,
    replacementRecommendedCount: 2, ageBuckets: { '>8': 2, '0-2': 0 } });
});

test('REGRESSION: template tenant benchmarks follow authorized selected B', async () => {
  const { body } = await request(app).get(`/templates/${template}/lifecycle`)
    .set(headers({ selected: b, allowed: [a, b] })).expect(200);
  expect(body.benchmarks.tenant.sampleAssets).toBe(2);
});

test('REGRESSION: template summary excludes B for A-only token without default Facility', async () => {
  const { body } = await request(app).get(`/templates/${template}/lifecycle`)
    .set(headers({ defaultFacility: null })).expect(200);
  expect(body.summary.totalAssets).toBe(3);
});

test('REGRESSION: template tenant benchmarks exclude B for A-only token without default Facility', async () => {
  const { body } = await request(app).get(`/templates/${template}/lifecycle`)
    .set(headers({ defaultFacility: null })).expect(200);
  expect(body.benchmarks.tenant.sampleAssets).toBe(3);
});

test('REGRESSION: Asset search plus explicit foreign facilityId cannot override A scope', async () => {
  const { body } = await request(app).get('/assets').query({ search: 'needle', facilityId: String(b) })
    .set(headers()).expect(200);
  expect(body.assets).toEqual([]);
});

test('BASELINE: duplicate warning can identify an accessible same-Facility Asset', async () => {
  const { body } = await request(app).post('/assets').set(headers()).send({
    facilityId: String(a), ctrlNumber: 'new-local-tag', manufacturer: 'Synthetic',
    model: 'Pump', serialNumber: assets[0].serialNumber,
  }).expect(201);
  expect(body.duplicateOf).toBe(String(assets[0]._id));
});

test('REGRESSION: duplicate warning must not expose an inaccessible B Asset identifier', async () => {
  const foreign = assets[1];
  const list = await request(app).get('/assets').set(headers()).expect(200);
  expect(list.body.assets.map(row => row._id)).not.toContain(String(foreign._id));
  const { body } = await request(app).post('/assets').set(headers()).send({
    facilityId: String(a), ctrlNumber: 'new-local-tag', manufacturer: 'Synthetic',
    model: 'Pump', serialNumber: foreign.serialNumber,
  }).expect(201);
  expect(body.asset.facilityId).toBe(String(a));
  expect(body.duplicateOf).not.toBe(String(foreign._id));
  expect(JSON.stringify(body)).not.toContain(String(foreign._id));
});
