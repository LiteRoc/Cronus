import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const require = createRequire(import.meta.url), m = require('mongoose');
const secret = 'synthetic-inventory-report-suite-only';
const id = () => new m.Types.ObjectId();
let h, app, A, F, D, facility, other, department, outsideDepartment;
jest.setTimeout(120000);
function headers(role = 'admin', selected = facility, claims = [facility]) {
  return { Authorization: `Bearer ${jwt.sign({ sub: String(id()), role, facilities: claims.map(String) }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`,
    ...(selected === null ? {} : { 'x-facility-id': String(selected) }) };
}
function get(query = {}, auth = headers()) { return request(app).get('/reports/inventory').set(auth).query(query); }
const asset = (overrides = {}) => ({ _id: id(), facilityId: facility, departmentId: department, ctrlNumber: String(id()), manufacturer: 'Synthetic', model: 'Pump', status: 'Active', ...overrides });
beforeAll(async () => {
  process.env.JWT_SECRET = secret; process.env.JWT_ISS = 'cronus.api'; process.env.JWT_AUD = 'cronus.app';
  process.env.CRON_ENABLED = 'false'; process.env.LIFECYCLE_CACHE_CRON_ENABLED = 'false';
  h = await createIsolatedMongoHarness(m);
  A = require('../../models/Asset'); F = require('../../models/Facility'); D = require('../../models/Department');
  app = express(); app.use('/reports/inventory', require('../inventoryReportRouter'));
});
beforeEach(async () => {
  facility = id(); other = id(); department = id(); outsideDepartment = id();
  await F.collection.insertMany([{ _id: facility, name: 'Synthetic A' }, { _id: other, name: 'Synthetic B' }]);
  await D.collection.insertMany([{ _id: department, facilityId: facility, name: 'Imaging' }, { _id: outsideDepartment, facilityId: other, name: 'Foreign private department' }]);
});
afterEach(async () => { try { if (h) await Promise.all([A?.deleteMany({}), F?.deleteMany({}), D?.deleteMany({})]); } finally { jest.restoreAllMocks(); } });
afterAll(async () => { if (h) await h.stop(); });
test('anonymous access denied', async () => { await get({}, {}).expect(401); });
test('filter choices are scoped and do not require generating the inventory', async () => {
  const { body } = await request(app).get('/reports/inventory/options').set(headers()).expect(200);
  expect(body).toEqual({ facilityId: String(facility), departments: [{ id: String(department), name: 'Imaging' }] });
  await request(app).get('/reports/inventory/options').expect(401);
  await request(app).get('/reports/inventory/options').set(headers('customer')).expect(403);
  await request(app).get('/reports/inventory/options').set(headers('technician', other)).expect(403);
});
test.each(['customer', 'viewer', 'tech'])('%s access denied', async role => { await get({}, headers(role)).expect(403); });
test('assigned technician can report; unassigned Facility cannot be selected', async () => {
  await get({}, headers('technician')).expect(200);
  await get({}, headers('technician', other)).expect(403);
});
test('selected Facility is mandatory, validated and must exist', async () => {
  await get({}, headers('admin', null)).expect(400);
  await get({}, { ...headers(), 'x-facility-id': 'bad' }).expect(400);
  await get({}, headers('admin', id())).expect(404);
});
test('inventory excludes foreign/global/deleted/archived rows and remains read-only', async () => {
  const own = asset({ ctrlNumber: 'A-1', serialNumber: 'SN-1', locationNote: 'Room 1', notes: 'PRIVATE-NOTE', purchaseCost: 9999,
    maintenanceSchedule: { frequency: 'Yearly', nextMaintenance: new Date('2027-01-01') } });
  const global = asset(); delete global.facilityId;
  const rows = [own, asset({ facilityId: other }), global, asset({ deletedAt: new Date() }), asset({ isArchived: true })];
  await A.collection.insertMany(rows);
  const before = await A.collection.find().sort({ _id: 1 }).toArray();
  const response = await get().expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.rows).toHaveLength(1);
  expect(response.body.rows[0]).toMatchObject({ id: String(own._id), ctrlNumber: 'A-1', department: 'Imaging', departmentState: 'resolved', nextPM: '2027-01-01T00:00:00.000Z' });
  expect(response.body.facility).toEqual({ id: String(facility), name: 'Synthetic A' });
  expect(JSON.stringify(response.body)).not.toContain('PRIVATE-NOTE');
  expect(response.body.rows[0]).not.toHaveProperty('purchaseCost');
  expect(await A.collection.find().sort({ _id: 1 }).toArray()).toEqual(before);
});
test('unresolved department never discloses foreign department name', async () => {
  await A.collection.insertMany([asset({ departmentId: outsideDepartment }), asset({ departmentId: null })]);
  const { body } = await get().expect(200);
  expect(body.dataQuality).toMatchObject({ unavailableDepartment: 1, unassignedDepartment: 1, missingSerial: 2, missingNextPM: 2 });
  expect(JSON.stringify(body)).not.toContain('Foreign private department');
});
test('department filter is strictly selected-Facility owned', async () => {
  await get({ departmentId: String(outsideDepartment) }).expect(404);
  await A.collection.insertMany([asset(), asset({ departmentId: null })]);
  expect((await get({ departmentId: 'unassigned' }).expect(200)).body.rowCount).toBe(1);
  expect((await get({ departmentId: String(department) }).expect(200)).body.rowCount).toBe(1);
});
test('status and archive filters are independent, deleted rows never included', async () => {
  await A.collection.insertMany([asset({ status: 'Retired' }), asset({ status: 'Retired', isArchived: true }), asset({ isArchived: true, deletedAt: new Date() })]);
  expect((await get({ status: 'Retired' }).expect(200)).body.rowCount).toBe(1);
  expect((await get({ archive: 'only' }).expect(200)).body.rowCount).toBe(1);
  expect((await get({ archive: 'all' }).expect(200)).body.rowCount).toBe(2);
});
test('search is literal and combines with class/status filters', async () => {
  await A.collection.insertMany([asset({ ctrlNumber: 'A.*1', equipmentClass: 'Pump' }), asset({ ctrlNumber: 'ABC1', equipmentClass: 'Pump' }), asset({ ctrlNumber: 'Z', equipmentClass: 'Monitor' })]);
  expect((await get({ q: '.*' }).expect(200)).body.rowCount).toBe(1);
  expect((await get({ equipmentClass: 'Pump', status: 'Active' }).expect(200)).body.rowCount).toBe(2);
});
test.each([{ status: 'bad' }, { archive: 'bad' }, { departmentId: 'bad' }, { q: 'x'.repeat(121) }, { facilityId: 'override' }, { status: ['Active', 'Retired'] }])('invalid filters %j rejected', async query => { await get(query).expect(400); });
test('empty report is explicit with generation metadata', async () => {
  const { body } = await get().expect(200);
  expect(body.rowCount).toBe(0); expect(body.rows).toEqual([]); expect(Number.isFinite(+new Date(body.generatedAt))).toBe(true);
});
test('over-limit result fails rather than returning partial inventory', async () => {
  await A.collection.insertMany(Array.from({ length: 5001 }, () => asset()));
  const { body } = await get().expect(413);
  expect(body.rows).toBeUndefined(); expect(body.error).toContain('Narrow the filters');
});
