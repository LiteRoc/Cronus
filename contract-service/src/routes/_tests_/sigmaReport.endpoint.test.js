import { createRequire } from 'node:module';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { jest } from '@jest/globals';
import Contract from '../../models/Contract.js';
import { createIsolatedMongoHarness } from '../../security/_tests_/securityTestHarness.js';

// Real routers, JWT verification, database queries and Core cost serialization.
// Only Axios transport is bridged to the synthetic Core app via Supertest;
// no application entry point, environment file, external API or scheduler runs.
const requireCore = createRequire(new URL('../../../../core-service/package.json', import.meta.url));
const coreMongoose = requireCore('mongoose');
const express = requireCore('express');
const secret = 'synthetic-sigma-http-suite-only-secret';
const id = () => new mongoose.Types.ObjectId();
let harness, app, core, WorkOrder, contract, facility, otherFacility, actor, asset;
let forwarded, transport, coreResponse;
jest.setTimeout(120000);

function headers(role = 'admin', selected = facility) {
  return {
    Authorization: `Bearer ${jwt.sign({ sub: String(actor), role, facilityId: String(facility), facilities: [String(facility)] }, secret,
      { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`,
    ...(selected === null ? {} : { 'x-facility-id': String(selected) }),
  };
}
const period = { startDate: '2026-02-01', endDate: '2026-02-28' };
function report(query = period, auth = headers(), contractId = contract._id) {
  return request(app).get(`/contracts/${contractId}/sigma-report`).set(auth).query(query);
}
function nativeWorkOrder(overrides = {}) {
  return {
    _id: id(), contractId: contract._id, facilityId: facility, assetId: asset,
    workOrderNumber: 900001, requestDate: new Date('2026-02-15T12:00:00Z'),
    status: 'Completed', workOrderType: 'Preventive Maintenance',
    economics: { schemaVersion: 1, revision: 1, origin: 'native' },
    timeLogs: [{ _id: id(), timeSpent: 120, laborRate: 50, laborCost: 100,
      // This documented test snapshot is not an approved operational labor rate.
      pricing: { version: 1, basis: 'documented', sourceKind: 'synthetic_fixture', sourceId: 'sigma-http-only',
        capturedBy: String(actor), capturedAt: new Date('2026-02-15') } }],
    travelLogs: [], partsUsed: [], ...overrides,
  };
}

beforeAll(async () => {
  // Contract auth bypasses JWT in NODE_ENV=test. Use the established security
  // suite mode instead, so every request exercises real token verification.
  process.env.NODE_ENV = 'security-test';
  process.env.CRON_ENABLED = 'false';
  process.env.LIFECYCLE_CACHE_CRON_ENABLED = 'false';
  process.env.JWT_SECRET = secret;
  process.env.JWT_ISS = 'cronus.api';
  process.env.JWT_AUD = 'cronus.app';
  harness = await createIsolatedMongoHarness({ coreMongoose, contractMongoose: mongoose });
  WorkOrder = requireCore('./src/models/WorkOrder');
  core = express();
  core.use(express.json());
  core.use('/workorders', requireCore('./src/routers/workOrderRouter'));
  app = (await import('../../../app.js')).createApp();
});

beforeEach(async () => {
  for (const level of ['log', 'warn', 'error']) jest.spyOn(console, level).mockImplementation(() => {});
  facility = id(); otherFacility = id(); actor = id(); asset = id();
  forwarded = []; coreResponse = null;
  contract = await Contract.create({
    contractNumber: `SYNTHETIC-SIGMA-${id()}`, name: 'Synthetic Sigma HTTP Contract', type: 'customer',
    facilityId: facility, startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'),
    totalValue: 3650, status: 'active', coveredAssets: [], amendments: [], vendorLinks: [],
  });
  transport = jest.spyOn(axios, 'create').mockImplementation(config => ({
    async get(path, options = {}) {
      if (path !== `/workorders/by-contract/${contract._id}`) throw new Error('Unapproved synthetic Core target');
      forwarded.push({ path, headers: { ...config.headers }, params: options.params });
      if (coreResponse) return coreResponse();
      const result = await request(core).get(path).set(config.headers).query(options.params);
      if (result.status !== 200) throw new Error('Synthetic Core request rejected');
      return { data: result.body };
    },
  }));
});

afterEach(async () => {
  // Cleanup is confined to collections connected by the isolated harness.
  try {
    if (harness) await Promise.all([Contract.deleteMany({}), WorkOrder?.deleteMany({})]);
  } finally { jest.restoreAllMocks(); }
});
afterAll(async () => { if (harness) await harness.stop(); });

test('anonymous request is rejected before any Core request', async () => {
  await report(period, {}).expect(401);
  expect(forwarded).toHaveLength(0);
});
test.each(['technician', 'customer', 'viewer'])('%s cannot read the internal financial report', async role => {
  await report(period, headers(role)).expect(403);
  expect(forwarded).toHaveLength(0);
});
test('invalid signature is rejected rather than using test auth bypass', async () => {
  await report(period, { ...headers(), Authorization: 'Bearer not-a-valid-token' }).expect(403);
  expect(forwarded).toHaveLength(0);
});
test.each([null, 'invalid-facility'])('missing or invalid selected Facility (%s) is rejected', async selected => {
  await report(period, headers('admin', selected)).expect(400);
  expect(forwarded).toHaveLength(0);
});
test('Contract cannot be read under a different selected Facility', async () => {
  await report(period, headers('admin', otherFacility)).expect(404);
  expect(forwarded).toHaveLength(0);
});
test('global Contract cannot enter a Facility report', async () => {
  await Contract.collection.updateOne({ _id: contract._id }, { $unset: { facilityId: '' } });
  await report().expect(404);
  expect(forwarded).toHaveLength(0);
});
test('invalid Contract ID is rejected', async () => {
  await report(period, headers(), 'invalid-id').expect(400);
  expect(forwarded).toHaveLength(0);
});
test.each([
  { startDate: '2026-02-30', endDate: '2026-03-01' },
  { startDate: '2026-03-01', endDate: '2026-02-28' },
  { startDate: '2020-01-01', endDate: '2026-02-28' },
  { startDate: '2026-02-01' },
])('invalid reporting period %j fails before Core lookup', async query => {
  await report(query).expect(400);
  expect(forwarded).toHaveLength(0);
});
test('real Core projection and canonical serializer produce a traceable read-only report', async () => {
  const row = nativeWorkOrder();
  await WorkOrder.collection.insertOne(row);
  const before = { contract: await Contract.findById(contract._id).lean(), workOrder: await WorkOrder.collection.findOne({ _id: row._id }) };
  const auth = headers();
  const result = await report(period, auth).expect(200);
  expect(result.headers['cache-control']).toBe('no-store');
  const data = result.body.data;
  expect(data.contract).toMatchObject({ id: String(contract._id), facilityId: String(facility) });
  expect(data.contractValue).toBe(280);
  expect(data.activity).toMatchObject({ total: 1, closed: 1, open: 0, preventive: 1, laborHours: 2 });
  expect(data.costs.scopes.directMaintenance).toMatchObject({ total: 100, knownSubtotal: 100, isComplete: true });
  expect(data.workOrders).toHaveLength(1);
  expect(data.workOrders[0]).toMatchObject({ id: String(row._id), number: row.workOrderNumber, assetId: String(asset), cost: { total: 100 } });
  expect(data.contribution).toBeNull();
  expect(data.marginPercent).toBeNull();
  expect(forwarded).toEqual([{
    path: `/workorders/by-contract/${contract._id}`,
    headers: expect.objectContaining(auth),
    params: { start: '2026-02-01T00:00:00.000Z', end: '2026-02-28T23:59:59.999Z', dateField: 'requestDate' },
  }]);
  expect(await Contract.findById(contract._id).lean()).toEqual(before.contract);
  expect(await WorkOrder.collection.findOne({ _id: row._id })).toEqual(before.workOrder);
});
test('request-date boundaries exclude archived, unlinked, other-Contract and foreign-Facility work', async () => {
  const first = nativeWorkOrder({ requestDate: new Date('2026-02-01T00:00:00.000Z') });
  const last = nativeWorkOrder({ requestDate: new Date('2026-02-28T23:59:59.999Z'), workOrderNumber: 900002 });
  await WorkOrder.collection.insertMany([first, last,
    nativeWorkOrder({ requestDate: new Date('2026-01-31T23:59:59.999Z') }),
    nativeWorkOrder({ requestDate: new Date('2026-03-01T00:00:00.000Z') }),
    nativeWorkOrder({ status: 'Archived' }), nativeWorkOrder({ contractId: id() }),
    nativeWorkOrder({ contractId: null }), nativeWorkOrder({ facilityId: otherFacility }),
  ]);
  const { body } = await report().expect(200);
  expect(body.data.workOrders.map(row => row.id).sort()).toEqual([String(first._id), String(last._id)].sort());
  expect(body.data.activity.total).toBe(2);
  expect(body.data.costs.scopes.directMaintenance.total).toBe(200);
});
test('Contract term clips the Core query and prorated value consistently', async () => {
  await Contract.collection.updateOne({ _id: contract._id }, { $set: { startDate: new Date('2026-02-10'), endDate: new Date('2026-02-20') } });
  const included = nativeWorkOrder({ requestDate: new Date('2026-02-19T23:59:59.999Z') });
  await WorkOrder.collection.insertMany([included,
    nativeWorkOrder({ requestDate: new Date('2026-02-09T23:59:59.999Z') }),
    nativeWorkOrder({ requestDate: new Date('2026-02-20T00:00:00.000Z') }),
  ]);
  const { body } = await report().expect(200);
  expect(body.data.contractValue).toBe(100);
  expect(body.data.workOrders.map(row => row.id)).toEqual([String(included._id)]);
  expect(forwarded[0].params).toMatchObject({ start: '2026-02-10T00:00:00.000Z', end: '2026-02-19T23:59:59.999Z' });
});
test('empty population reports no work without certifying period margin', async () => {
  const { body } = await report().expect(200);
  expect(body.data.activity.total).toBe(0);
  expect(body.data.workOrders).toEqual([]);
  expect(body.data.contribution).toBeNull();
});
test('legacy costs remain unknown through the real Core serializer', async () => {
  const legacy = nativeWorkOrder(); delete legacy.economics;
  await WorkOrder.collection.insertOne(legacy);
  const { body } = await report().expect(200);
  // No versioned economics envelope: Contract's established adapter rejects
  // the entire cost scope, even if Core can derive individual legacy amounts.
  expect(body.data.costs.scopes.directMaintenance).toMatchObject({ knownSubtotal: 0, total: null, isComplete: false });
  expect(body.data.workOrders[0].cost.missingComponents).toEqual([{ reason: 'canonical_cost_unavailable' }]);
  expect(body.data.workOrders[0].cost.total).toBeNull();
  expect(body.data.contribution).toBeNull();
});
test('versioned partial costs preserve priced labor while travel and the total remain unknown', async () => {
  await WorkOrder.collection.insertOne(nativeWorkOrder({ travelLogs: [{ _id: id(), travelTime: 30 }] }));
  const { body } = await report().expect(200);
  expect(body.data.costs.scopes.directMaintenance).toMatchObject({ knownSubtotal: 100, total: null, isComplete: false });
  expect(body.data.costs.components.internalLabor).toMatchObject({ knownSubtotal: 100, total: 100, isComplete: true });
  expect(body.data.workOrders[0].cost.missingComponents).toEqual(expect.arrayContaining([
    expect.objectContaining({ reason: 'travel_policy_unapproved' }),
  ]));
  expect(body.data.activity.travelHours).toBe(0.5);
  expect(body.data.contribution).toBeNull();
});
test('upstream outage returns unavailable rather than a complete empty report', async () => {
  coreResponse = () => { throw new Error('Synthetic private upstream diagnostic'); };
  const { body } = await report().expect(503);
  expect(body.data).toBeUndefined();
  expect(JSON.stringify(body)).not.toContain('private upstream diagnostic');
});
test('upstream response missing scope identifiers fails closed (older Core compatibility)', async () => {
  coreResponse = () => ({ data: { workOrders: [{ _id: String(id()), requestDate: '2026-02-15', timeLogs: [], partsUsed: [] }] } });
  await report().expect(503);
});
test('upstream foreign-Facility row fails closed even if Core returns it', async () => {
  coreResponse = () => ({ data: { workOrders: [nativeWorkOrder({ facilityId: otherFacility })] } });
  await report().expect(503);
});
test('successive requests carry their own JWT and selected Facility', async () => {
  const first = headers();
  actor = id();
  const second = headers('admin', otherFacility);
  expect(first.Authorization).not.toBe(second.Authorization);
  await report(period, first).expect(200);
  await Contract.collection.updateOne({ _id: contract._id }, { $set: { facilityId: otherFacility } });
  await report(period, second).expect(200);
  expect(forwarded.map(call => call.headers.Authorization)).toEqual([first.Authorization, second.Authorization]);
  expect(forwarded.map(call => call.headers['x-facility-id'])).toEqual([String(facility), String(otherFacility)]);
  expect(transport).toHaveBeenCalledTimes(2);
});
