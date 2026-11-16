import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const require = createRequire(import.meta.url), m = require('mongoose'), id = () => new m.Types.ObjectId();
const secret = 'synthetic-open-pm-only'; let h, app, W, A, F, facility, other;
jest.setTimeout(120000);
function headers(role = 'admin', selected = facility, claims = [facility]) { return { Authorization: `Bearer ${jwt.sign({ sub: String(id()), role, facilities: claims.map(String) }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`, ...(selected === null ? {} : { 'x-facility-id': String(selected) }) }; }
const get = (q = {}, auth = headers()) => request(app).get('/reports/work-orders').set(auth).query({ mode: 'pm', ...q });
const row = (extra = {}) => ({ _id: id(), facilityId: facility, assetId: id(), workOrderNumber: 1, status: 'Open', workOrderType: 'Planned Maintenance', description: 'Synthetic PM', ...extra });
beforeAll(async () => {
  process.env.JWT_SECRET = secret; process.env.JWT_ISS = 'cronus.api'; process.env.JWT_AUD = 'cronus.app'; process.env.CRON_ENABLED = 'false'; process.env.LIFECYCLE_CACHE_CRON_ENABLED = 'false';
  h = await createIsolatedMongoHarness(m); W = require('../../models/WorkOrder'); A = require('../../models/Asset'); F = require('../../models/Facility');
  app = express(); app.use('/reports/work-orders', require('../workOrderReportRouter'));
});
beforeEach(async () => { facility = id(); other = id(); await F.collection.insertMany([{ _id: facility, name: 'Synthetic PM A' }, { _id: other, name: 'Synthetic PM B' }]); });
afterEach(async () => { try { if (h) await Promise.all([W?.deleteMany({}), A?.deleteMany({}), F?.deleteMany({})]); } finally { jest.restoreAllMocks(); } });
afterAll(async () => { if (h) await h.stop(); });
test('PM requires authenticated authorized role and exact facility claim', async () => {
  await get({}, {}).expect(401); await get({}, headers('viewer')).expect(403); await get({}, headers('admin', null)).expect(400);
  await get({}, headers('technician', other)).expect(403); await get({}, headers('technician')).expect(200);
});
test('PM cohort has exact types and open statuses, excludes deleted/foreign/unscoped records and preserves data', async () => {
  const unscoped = row(); delete unscoped.facilityId;
  await W.collection.insertMany([row(), row({ workOrderType: 'Preventive Maintenance', status: 'Requested' }), row({ workOrderType: 'PM', status: 'In Progress' }), row({ workOrderType: 'Corrective Maintenance' }), row({ workOrderType: 'PM repair' }), row({ status: 'Completed' }), row({ status: 'Archived' }), row({ facilityId: other }), row({ deletedAt: new Date() }), unscoped]);
  const before = await W.collection.find().sort({ _id: 1 }).toArray(); const r = await get().expect(200);
  expect(r.body.summary).toMatchObject({ count: 3, missingDueDates: 3 }); expect(r.headers['cache-control']).toBe('no-store');
  expect(await W.collection.find().sort({ _id: 1 }).toArray()).toEqual(before);
});
test('overdue, upcoming and missing use WO dueDate rather than scheduledDate', async () => {
  const now = Date.now(); await W.collection.insertMany([row({ workOrderNumber: 1, dueDate: new Date(now - 86400000), scheduledDate: new Date(now + 86400000) }), row({ workOrderNumber: 2, dueDate: new Date(now + 86400000) }), row({ workOrderNumber: 3, dueDate: new Date(now + 31 * 86400000) }), row({ workOrderNumber: 4, dueDate: null }), row({ workOrderNumber: 5 })]);
  expect((await get({ dueStatus: 'overdue' }).expect(200)).body.rows.map(r => r.number)).toEqual([1]);
  expect((await get({ dueStatus: 'next30' }).expect(200)).body.rows.map(r => r.number)).toEqual([2]);
  expect((await get({ dueStatus: 'missing' }).expect(200)).body.rows.map(r => r.number).sort()).toEqual([4, 5]);
});
test('due range is inclusive UTC with stable due ordering and exact priority', async () => {
  await W.collection.insertMany([row({ workOrderNumber: 1, dueDate: new Date('2026-02-01'), priority: 'High' }), row({ workOrderNumber: 2, dueDate: new Date('2026-02-28T23:59:59.999Z'), priority: 'High' }), row({ dueDate: new Date('2026-03-01'), priority: 'High' }), row({ dueDate: new Date('2026-02-15'), priority: 'Normal' }), row({ priority: 'High' })]);
  const r = await get({ dueStatus: 'range', startDate: '2026-02-01', endDate: '2026-02-28', priority: 'High' }).expect(200);
  expect(r.body.rows.map(r => r.number)).toEqual([1, 2]); await get({ dueStatus: 'range' }).expect(400); await get({ workOrderType: 'CM' }).expect(400);
});
test('foreign/deleted asset labels never leak and limit rejects partial PM exports', async () => {
  const asset = id(); await A.collection.insertOne({ _id: asset, facilityId: other, ctrlNumber: 'FOREIGN-PRIVATE' }); await W.collection.insertOne(row({ assetId: asset }));
  const r = await get().expect(200); expect(r.body.rows[0].asset).toBeNull(); expect(JSON.stringify(r.body)).not.toContain('FOREIGN-PRIVATE');
  await W.collection.insertMany(Array.from({ length: 5000 }, () => row())); await get().expect(413);
});
