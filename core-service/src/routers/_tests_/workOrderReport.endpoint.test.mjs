import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const require = createRequire(import.meta.url), m = require('mongoose');
const id = () => new m.Types.ObjectId(), secret = 'synthetic-work-order-report-only';
let h, app, W, A, F, facility, other;
jest.setTimeout(120000);
function headers(role = 'admin', selected = facility, claims = [facility]) { return { Authorization: `Bearer ${jwt.sign({ sub: String(id()), role, facilities: claims.map(String) }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`, ...(selected === null ? {} : { 'x-facility-id': String(selected) }) }; }
const get = (query = {}, auth = headers()) => request(app).get('/reports/work-orders').set(auth).query(query);
const row = (extra = {}) => ({ _id: id(), facilityId: facility, assetId: id(), workOrderNumber: 1, status: 'Open', description: 'Synthetic', requestDate: new Date('2026-01-01'), ...extra });
const closed = { mode: 'closed', startDate: '2026-02-01', endDate: '2026-02-28' };
beforeAll(async () => {
  process.env.JWT_SECRET = secret; process.env.JWT_ISS = 'cronus.api'; process.env.JWT_AUD = 'cronus.app'; process.env.CRON_ENABLED = 'false'; process.env.LIFECYCLE_CACHE_CRON_ENABLED = 'false';
  h = await createIsolatedMongoHarness(m); W = require('../../models/WorkOrder'); A = require('../../models/Asset'); F = require('../../models/Facility');
  app = express(); app.use('/reports/work-orders', require('../workOrderReportRouter'));
});
beforeEach(async () => { facility = id(); other = id(); await F.collection.insertMany([{ _id: facility, name: 'Synthetic A' }, { _id: other, name: 'Synthetic B' }]); });
afterEach(async () => { try { if (h) await Promise.all([W?.deleteMany({}), A?.deleteMany({}), F?.deleteMany({})]); } finally { jest.restoreAllMocks(); } });
afterAll(async () => { if (h) await h.stop(); });
test('anonymous and unsupported roles denied', async () => { await get({}, {}).expect(401); for (const role of ['viewer', 'customer', 'tech']) await get({}, headers(role)).expect(403); });
test('exact existing selected facility and technician claims required', async () => {
  await get({}, headers('admin', null)).expect(400); await get({}, { ...headers(), 'x-facility-id': 'bad' }).expect(400);
  await get({}, headers('admin', id())).expect(404); await get({}, headers('technician', other)).expect(403); await get({}, headers('technician')).expect(200);
});
test('open cohort, deletion, foreign and unscoped rows, read-only response and asset privacy', async () => {
  const own = id(), foreign = id(), deleted = id();
  await A.collection.insertMany([{ _id: own, facilityId: facility, ctrlNumber: 'SYN-1', notes: 'PRIVATE' }, { _id: foreign, facilityId: other, ctrlNumber: 'FOREIGN-SECRET' }, { _id: deleted, facilityId: facility, ctrlNumber: 'DELETED-SECRET', deletedAt: new Date() }]);
  const global = row(); delete global.facilityId;
  await W.collection.insertMany([row({ assetId: own }), row({ status: 'Requested', assetId: foreign }), row({ status: 'In Progress', assetId: deleted }), row({ status: 'Completed' }), row({ status: 'Archived' }), row({ deletedAt: new Date() }), row({ facilityId: other }), global]);
  const before = await W.collection.find().sort({ _id: 1 }).toArray(); const response = await get().expect(200);
  expect(response.headers['cache-control']).toBe('no-store'); expect(response.body.summary).toMatchObject({ count: 3, unavailableAssets: 2 });
  expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE|FOREIGN-SECRET|DELETED-SECRET/);
  expect(await W.collection.find().sort({ _id: 1 }).toArray()).toEqual(before);
});
test('closed selection uses completion date inclusively, never request date, and archives are opt-in', async () => {
  await W.collection.insertMany([row({ workOrderNumber: 1, status: 'Completed', completionDate: new Date('2026-02-01') }), row({ workOrderNumber: 2, status: 'Completed', completionDate: new Date('2026-02-28T23:59:59.999Z') }), row({ status: 'Completed', completionDate: new Date('2026-03-01') }), row({ status: 'Completed' }), row({ status: 'Archived', workOrderNumber: 3, completionDate: new Date('2026-02-15') }), row({ status: 'Archived' }), row({ completionDate: new Date('2026-02-15') })]);
  expect((await get(closed).expect(200)).body.rows.map(r => r.number)).toEqual([2, 1]);
  expect((await get({ ...closed, includeArchived: 'true' }).expect(200)).body.rows.map(r => r.number)).toEqual([2, 3, 1]);
});
test('priority and type are exact values and malformed filters rejected', async () => {
  await W.collection.insertMany([row({ priority: 'High', workOrderType: 'PM' }), row({ priority: 'Normal', workOrderType: 'PM' }), row({ priority: 'High', workOrderType: 'CM' })]);
  expect((await get({ priority: 'High', workOrderType: 'PM' }).expect(200)).body.rows).toHaveLength(1);
  expect((await get({ workOrderType: '.*' }).expect(200)).body.rows).toHaveLength(0);
  for (const filters of [{ mode: 'closed' }, { includeArchived: 'true' }, { facilityId: String(other) }, { priority: ['High', 'Low'] }]) await get(filters).expect(400);
});
test('limit rejects without partial report and database errors return safe error', async () => {
  await W.collection.insertMany(Array.from({ length: 5001 }, () => row())); await get().expect(413);
  jest.spyOn(W, 'find').mockImplementation(() => { throw new Error('PRIVATE-DATABASE-DETAIL'); });
  const response = await get().expect(503); expect(JSON.stringify(response.body)).not.toContain('PRIVATE-DATABASE-DETAIL');
});
