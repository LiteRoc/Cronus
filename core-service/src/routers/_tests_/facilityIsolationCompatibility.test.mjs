import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const secret = 'synthetic-facility-compatibility-signing-key';
let harness, app, Asset, WorkOrder, Template, Facility, a, b, template, rows;
jest.setTimeout(120000);

function headers({ role = 'technician', selected = a, allowed = [a], defaultFacility = a } = {}) {
  return {
    Authorization: `Bearer ${jwt.sign({
      sub: '000000000000000000000001', role,
      ...(defaultFacility ? { facilityId: String(defaultFacility) } : {}),
      facilities: allowed.map(value => typeof value === 'object' && value._id ? value : String(value)),
    }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`,
    ...(selected === null ? {} : { 'x-facility-id': String(selected) }),
  };
}

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  process.env.JWT_ISS = 'cronus.api';
  process.env.JWT_AUD = 'cronus.app';
  harness = await createIsolatedMongoHarness(mongoose);
  Facility = requireCore('./src/models/Facility.js');
  Asset = requireCore('./src/models/Asset.js');
  WorkOrder = requireCore('./src/models/WorkOrder.js');
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
  // #6 creation validates that the selected synthetic Facility exists.
  await Facility.collection.insertMany([{ _id: a, name: 'Synthetic A' }, { _id: b, name: 'Synthetic B' }]);
  template = new mongoose.Types.ObjectId();
  await Template.collection.insertOne({ _id: template, manufacturer: 'Synthetic', model: 'Pump' });
  rows = [{ facilityId: a }, { facilityId: b }, {}, { facilityId: null }].map((scope, i) => ({
    _id: new mongoose.Types.ObjectId(), templateId: template, manufacturer: 'Synthetic',
    model: 'Pump', ctrlNumber: `needle-${i}`, serialNumber: `serial-${i}`,
    status: 'Active', metrics: { yearsInService: 1, projectedAnnualMaintenance: 10 }, ...scope,
  }));
  await Asset.collection.insertMany(rows);
  await WorkOrder.collection.insertMany(rows.map(row => ({
    _id: row._id, assetId: row._id, description: row.ctrlNumber, status: 'Open',
    requestDate: new Date('2026-01-01T00:00:00Z'),
    ...(Object.hasOwn(row, 'facilityId') ? { facilityId: row.facilityId } : {}),
  })));
});
afterEach(async () => {
  await Facility.deleteMany({});
  if (harness) for (const model of [Asset, WorkOrder, Template]) if (model) await model.deleteMany({});
  jest.restoreAllMocks();
});
afterAll(async () => { if (harness) await harness.stop(); });

for (const target of [
  { path: '/assets', search: { search: 'needle' }, key: 'assets', total: 'totalAssets' },
  { path: '/workorders', search: { q: 'needle' }, key: 'items', total: 'total' },
]) {
  for (const [label, context, indices] of [
    ['technician includes global records', {}, [0, 2]],
    ['selected administrator includes global records', { role: 'admin' }, [0, 2]],
    ['unselected administrator keeps existing global/all-Facility policy', { role: 'admin', selected: null }, [0, 1, 2]],
  ]) {
    test(`${target.path}: ${label}, including search and counts`, async () => {
      for (const query of [{}, target.search]) {
        const { body } = await request(app).get(target.path).set(headers(context)).query(query).expect(200);
        expect(body[target.key].map(row => row._id).sort()).toEqual(indices.map(i => String(rows[i]._id)).sort());
        expect(body[target.total]).toBe(indices.length);
      }
    });
  }
}
test('customer Asset search retains visible global records and correct page counts', async () => {
  const pages = await Promise.all([1, 2].map(page => request(app).get('/assets')
    .query({ search: 'needle', limit: 1, page }).set(headers({ role: 'customer' })).expect(200)));
  expect(pages.flatMap(({ body }) => body.assets.map(row => row._id)).sort())
    .toEqual([String(rows[0]._id), String(rows[2]._id)].sort());
  for (const { body } of pages) {
    expect(body.assets).toHaveLength(1);
    expect(body.totalAssets).toBe(2);
    expect(body.totalPages).toBe(2);
  }
});
test('Asset explicit Facility filter narrows away global records', async () => {
  const { body } = await request(app).get('/assets').set(headers())
    .query({ search: 'needle', facilityId: String(a), manufacturer: 'Synthetic' }).expect(200);
  expect(body.assets.map(row => row._id)).toEqual([String(rows[0]._id)]);
  expect(body.totalAssets).toBe(1);
});
test('Work Order analytics combines search/status/foreign Asset filters with scope', async () => {
  const { body } = await request(app).get('/workorders').set(headers())
    .query({ q: 'needle', mode: 'analytics', status: 'Open', assetId: String(rows[1]._id) }).expect(200);
  expect(body.items).toEqual([]);
  expect(body.total).toBe(0);
});
for (const [label, context, status] of [
  ['missing selection', { selected: null }, 400],
  ['malformed selection', { selected: 'not-an-id' }, 400],
  ['unauthorized selection despite default claim', { selected: () => b }, 403],
]) {
  test(`template lifecycle rejects ${label}`, async () => {
    const ctx = { ...context };
    if (typeof ctx.selected === 'function') ctx.selected = ctx.selected();
    await request(app).get(`/templates/${template}/lifecycle`).set(headers(ctx)).expect(status);
  });
}
test('template lifecycle accepts object-shaped authorized Facility claims', async () => {
  const { body } = await request(app).get(`/templates/${template}/lifecycle`)
    .set(headers({ selected: b, allowed: [{ _id: String(b) }], defaultFacility: null })).expect(200);
  expect(body.summary.totalAssets).toBe(1);
  expect(body.benchmarks.tenant.sampleAssets).toBe(1);
});
test('administrator lifecycle remains selected-Facility-only, excluding global Assets', async () => {
  const { body } = await request(app).get(`/templates/${template}/lifecycle`)
    .set(headers({ role: 'admin', selected: b })).expect(200);
  expect(body.summary.totalAssets).toBe(1);
  expect(body.benchmarks.tenant.sampleAssets).toBe(1);
});
test('duplicate warning retains advisory behavior for visible global record', async () => {
  const { body } = await request(app).post('/assets').set(headers()).send({
    facilityId: String(a), ctrlNumber: 'new-tag', serialNumber: rows[2].serialNumber,
    manufacturer: 'Synthetic', model: 'Pump',
  }).expect(201);
  expect(body.duplicateOf).toBe(String(rows[2]._id));
});
test('existing unique tag conflict does not expose foreign identifier', async () => {
  await Asset.init();
  const { body } = await request(app).post('/assets').set(headers()).send({
    facilityId: String(a), ctrlNumber: rows[1].ctrlNumber,
    manufacturer: 'Synthetic', model: 'Pump',
  }).expect(409);
  expect(body.duplicateOf).toBeUndefined();
  expect(JSON.stringify(body)).not.toContain(String(rows[1]._id));
});
