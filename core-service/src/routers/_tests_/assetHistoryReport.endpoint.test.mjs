import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const require = createRequire(import.meta.url), m = require('mongoose');
const secret = 'synthetic-asset-history-suite-only'; const id = () => new m.Types.ObjectId();
let app, h, A, W, F, D, P, facility, foreign, assetId, dept;
jest.setTimeout(120000);
function headers(role = 'admin', selected = facility) {
  return { Authorization: `Bearer ${jwt.sign({ sub: String(id()), role, facilities: [String(facility)] }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`,
    ...(selected === null ? {} : { 'x-facility-id': String(selected) }) };
}
const workOrder = (overrides = {}) => ({ _id: id(), assetId, facilityId: facility, workOrderNumber: 1, requestDate: new Date('2026-02-15'), status: 'Completed', description: 'Synthetic service request',
  timeLogs: [], travelLogs: [], partsUsed: [], economics: { schemaVersion: 1, revision: 1, origin: 'native' }, ...overrides });
const get = (query = { assetId: String(assetId) }, auth = headers()) => request(app).get('/reports/asset-history').set(auth).query(query);
beforeAll(async () => {
  process.env.JWT_SECRET = secret; process.env.JWT_ISS = 'cronus.api'; process.env.JWT_AUD = 'cronus.app';
  process.env.CRON_ENABLED = 'false'; process.env.LIFECYCLE_CACHE_CRON_ENABLED = 'false';
  h = await createIsolatedMongoHarness(m);
  A = require('../../models/Asset'); W = require('../../models/WorkOrder'); F = require('../../models/Facility'); D = require('../../models/Department'); P = require('../../models/Part');
  app = express(); app.use('/reports/asset-history', require('../assetHistoryReportRouter'));
});
beforeEach(async () => {
  facility = id(); foreign = id(); assetId = id(); dept = id();
  await F.collection.insertMany([{ _id: facility, name: 'Synthetic A' }, { _id: foreign, name: 'Synthetic B' }]);
  await D.collection.insertOne({ _id: dept, facilityId: facility, name: 'Imaging' });
  await A.collection.insertOne({ _id: assetId, facilityId: facility, departmentId: dept, ctrlNumber: 'HISTORY-1', manufacturer: 'Synthetic', model: 'Pump', notes: 'PRIVATE ASSET NOTE', workOrders: [] });
});
afterEach(async () => { if (h) await Promise.all([A?.deleteMany({}), W?.deleteMany({}), F?.deleteMany({}), D?.deleteMany({}), P?.deleteMany({})]); });
afterAll(async () => { if (h) await h.stop(); });
test('anonymous requests denied', async () => { await get(undefined, {}).expect(401); });
test.each(['customer', 'viewer', 'tech'])('%s denied', async role => { await get(undefined, headers(role)).expect(403); });
test('technician must have selected Facility access', async () => { await get(undefined, headers('technician')).expect(200); await get(undefined, headers('technician', foreign)).expect(403); });
test('missing/invalid Facility and Asset IDs fail without broadening scope', async () => {
  await get(undefined, headers('admin', null)).expect(400); await get({ assetId: 'bad' }).expect(400); await get(undefined, headers('admin', foreign)).expect(404);
});
test.each([{}, { controlNumber: 'A', assetId: '000000000000000000000001' }, { controlNumber: 'A', startDate: '2026-02-01' }, { controlNumber: 'A', startDate: '2026-02-30', endDate: '2026-03-01' }, { controlNumber: 'A', q: 'unsupported' }])('invalid filters %j rejected', async query => { await get(query).expect(400); });
test('history uses direct asset links, includes archived and excludes deleted/foreign/unrelated WOs', async () => {
  const own = workOrder(); const archived = workOrder({ status: 'Archived', requestDate: new Date('2026-02-28T23:59:59.999Z') });
  await W.collection.insertMany([own, archived, workOrder({ deletedAt: new Date() }), workOrder({ facilityId: foreign }), workOrder({ assetId: id() })]);
  const before = await W.collection.find().sort({ _id: 1 }).toArray();
  const assetBefore = await A.collection.findOne({ _id: assetId });
  const result = await get().expect(200);
  expect(result.headers['cache-control']).toBe('no-store');
  expect(result.body.rows.map(row => row.id)).toEqual([String(archived._id), String(own._id)]);
  expect(result.body.asset).toMatchObject({ ctrlNumber: 'HISTORY-1', department: 'Imaging' });
  expect(JSON.stringify(result.body)).not.toContain('PRIVATE ASSET NOTE');
  expect(await W.collection.find().sort({ _id: 1 }).toArray()).toEqual(before); expect(await A.collection.findOne({ _id: assetId })).toEqual(assetBefore);
});
test('exact control number and inclusive UTC dates filter request dates only', async () => {
  const included = workOrder({ requestDate: new Date('2026-02-28T23:59:59.999Z'), completionDate: new Date('2026-03-10') });
  await W.collection.insertMany([included, workOrder({ requestDate: new Date('2026-03-01') }), workOrder({ requestDate: null })]);
  const { body } = await get({ controlNumber: 'HISTORY-1', startDate: '2026-02-01', endDate: '2026-02-28' }).expect(200);
  expect(body.rows.map(row => row.id)).toEqual([String(included._id)]); expect(body.rows[0].completed).toBe('2026-03-10T00:00:00.000Z');
  await get({ controlNumber: 'HISTORY' }).expect(404);
});
test('archived Asset is readable for history; deleted Asset is unavailable', async () => {
  await A.collection.updateOne({ _id: assetId }, { $set: { isArchived: true } }); expect((await get().expect(200)).body.asset.isArchived).toBe(true);
  await A.collection.updateOne({ _id: assetId }, { $set: { deletedAt: new Date() } }); await get().expect(404);
});
test('foreign department label is hidden and missing parts are explicit', async () => {
  const foreignDept = id(); await D.collection.insertOne({ _id: foreignDept, facilityId: foreign, name: 'FOREIGN PRIVATE' });
  await A.collection.updateOne({ _id: assetId }, { $set: { departmentId: foreignDept } });
  const partId = id(); await W.collection.insertOne(workOrder({ partsUsed: [{ partId, quantity: 2, note: 'Recorded part usage' }] }));
  const { body } = await get().expect(200);
  expect(body.asset.departmentState).toBe('unavailable'); expect(JSON.stringify(body)).not.toContain('FOREIGN PRIVATE');
  expect(body.rows[0].parts[0]).toMatchObject({ id: String(partId), quantity: 2, referenceState: 'unavailable' });
  expect(body.summary.scopes.directMaintenance.total).toBeNull();
});
test('current shared catalog label does not supply current price as historical cost', async () => {
  const partId = id(); await P.collection.insertOne({ _id: partId, partNumber: 'CURRENT-P1', description: 'Current shared label', price: 999 });
  await W.collection.insertOne(workOrder({ partsUsed: [{ partId, quantity: 1 }] }));
  const { body } = await get().expect(200);
  expect(body.rows[0].parts[0].number).toBe('CURRENT-P1'); expect(body.summary.components.internalParts.total).toBeNull(); expect(body.rows[0].parts[0]).not.toHaveProperty('price');
});
test('legacy cost remains incomplete; no-history response explicitly has zero recorded rows', async () => {
  expect((await get().expect(200)).body.summary.workOrderCount).toBe(0);
  const legacy = workOrder(); delete legacy.economics; await W.collection.insertOne(legacy);
  const { body } = await get().expect(200); expect(body.summary.scopes.directMaintenance.total).toBeNull(); expect(body.rows[0].costState).toBe('legacy');
});
test('too much history fails rather than returning a truncated timeline', async () => {
  await W.collection.insertMany(Array.from({ length: 1001 }, () => workOrder())); const { body } = await get().expect(413); expect(body.rows).toBeUndefined();
});
