import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../src/test/mongoMemoryHarness.mjs';
const require = createRequire(import.meta.url),
  m = require('mongoose');
let app, h, W, P, rates, mut, engine, repair, imports, org, f, other, actor, asset;
const secret = 'synthetic-costs-only',
  id = () => new m.Types.ObjectId();
jest.setTimeout(120000);
const admin = () => ({
  id: String(actor),
  role: 'admin'
});
const headers = (role = 'technician', facility = f) => ({
  'x-facility-id': String(facility),
  Authorization: `Bearer ${jwt.sign({
    sub: String(actor),
    role,
    facilityId: String(facility),
    facilities: [String(facility)]
  }, secret, {
    issuer: 'cronus.api',
    audience: 'cronus.app'
  })}`
});
const native = () => mut.createNative({
  facilityId: f,
  assetId: asset,
  description: 'Synthetic',
  createdBy: actor
});
const publish = (rate = 75, revision = 0) => rates.publish({
  organizationId: org,
  expectedRevision: revision,
  reason: 'Synthetic approval',
  periods: [{
    effectiveFrom: '2024-01-01',
    effectiveTo: '2025-01-01',
    rate,
    evidenceRef: 'synthetic'
  }]
}, admin());
beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  h = await createIsolatedMongoHarness(m);
  W = require('../../src/models/WorkOrder');
  P = require('../../src/models/Part');
  rates = require('../../src/services/internalCostRates');
  mut = require('../../src/services/workOrderCosts/mutate');
  engine = require('../../src/services/workOrderCosts/calculate');
  repair = require('../../src/services/workOrderCosts/repair');
  imports = require('../../src/services/workOrderCosts/import');
  app = express();
  app.use(express.json());
  app.use('/workorders', require('../../src/routers/workOrderRouter'));
  app.use('/rates', require('../../src/routers/internalCostRateRouter'));
  app.use('/internal-cost-rates', require('../../src/routers/internalCostRateRouter'));
  org = id();
  f = id();
  other = id();
  actor = id();
  asset = id();
  await m.model('Organization').create({
    _id: org,
    name: 'Synthetic network'
  });
  await m.model('Facility').create([{
    _id: f,
    organizationId: org,
    name: 'A',
    timezone: 'America/New_York'
  }, {
    _id: other,
    organizationId: org,
    name: 'B',
    timezone: 'UTC'
  }]);
  await m.connection.collection('assets').insertOne({
    _id: asset,
    facilityId: f
  });
});
afterEach(async () => {
  jest.restoreAllMocks();
  await W.deleteMany({});
  await P.deleteMany({});
  await m.connection.collection('internalcostrateschedules').deleteMany({});
});
afterAll(async () => h?.stop());

// Frozen characterization of bcab77b: deliberately excluded from permanent gates.
test('frontend sends PATCH to the unimplemented time-log edit endpoint', () => {
  const source = readFileSync(new URL('../../../frontend/src/services/workOrderAPI.ts', import.meta.url), 'utf8');
  expect(source).toContain('apiClient.patch<TimeLog>(`/workorders/${workOrderId}/time-logs/${timeLogId}`, updates)');
});
test('authorized labor PATCH currently returns 404 and leaves the snapshot unchanged', async () => {
  await publish(); const w = await native();
  await request(app).post(`/workorders/${w.id}/time-logs`).set(headers()).send({timeSpent:60,workDate:'2024-06-01'}).expect(200);
  const before = await W.collection.findOne({_id:w._id});
  await request(app).patch(`/workorders/${w.id}/time-logs/${before.timeLogs[0]._id}`).set(headers()).send({timeSpent:90}).expect(404);
  expect(await W.collection.findOne({_id:w._id})).toEqual(before);
});
test('delete and re-add performs fresh schedule lookup and changes historical economics', async () => {
  await publish(); const w = await native();
  await request(app).post(`/workorders/${w.id}/time-logs`).set(headers()).send({timeSpent:60,workDate:'2024-06-01'}).expect(200);
  const before = (await W.findById(w.id).lean()).timeLogs[0];
  await publish(100,1);
  const lookup=jest.spyOn(rates,'resolve');
  await request(app).delete(`/workorders/${w.id}/time-logs/${before._id}`).set(headers()).expect(200);
  await request(app).post(`/workorders/${w.id}/time-logs`).set(headers()).send({timeSpent:60,workDate:'2024-06-01'}).expect(200);
  const after=(await W.findById(w.id).lean()).timeLogs[0];
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(before.laborRate).toBe(75); expect(after.laborRate).toBe(100);
  expect(after._id).not.toEqual(before._id);
});
