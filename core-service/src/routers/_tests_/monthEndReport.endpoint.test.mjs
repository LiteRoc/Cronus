import { createRequire } from 'node:module';
import express from 'express'; import jwt from 'jsonwebtoken'; import request from 'supertest'; import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const require = createRequire(import.meta.url), m = require('mongoose'), id = () => new m.Types.ObjectId(), secret = 'synthetic-month-end-only';
let h, app, W, A, F, facility, other; jest.setTimeout(120000);
const filters = { month: '2026-02' };
function headers(role = 'admin', selected = facility, claims = [facility]) { return { Authorization: `Bearer ${jwt.sign({ sub: String(id()), role, facilities: claims.map(String) }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`, ...(selected === null ? {} : { 'x-facility-id': String(selected) }) }; }
const get = (q = filters, auth = headers()) => request(app).get('/reports/month-end').set(auth).query(q);
const row = (extra = {}) => ({ _id: id(), facilityId: facility, assetId: id(), status: 'Completed', description: 'Synthetic', completionDate: new Date('2026-02-15'), ...extra });
beforeAll(async () => { process.env.JWT_SECRET = secret; process.env.JWT_ISS = 'cronus.api'; process.env.JWT_AUD = 'cronus.app'; process.env.CRON_ENABLED = 'false'; process.env.LIFECYCLE_CACHE_CRON_ENABLED = 'false'; h = await createIsolatedMongoHarness(m); W = require('../../models/WorkOrder'); A = require('../../models/Asset'); F = require('../../models/Facility'); app = express(); app.use('/reports/month-end', require('../monthEndReportRouter')); });
beforeEach(async () => { facility = id(); other = id(); await F.collection.insertMany([{ _id: facility, name: 'Synthetic A' }, { _id: other, name: 'Synthetic B' }]); });
afterEach(async () => { try { if (h) await Promise.all([W?.deleteMany({}), A?.deleteMany({}), F?.deleteMany({})]); } finally { jest.restoreAllMocks(); } }); afterAll(async () => { if (h) await h.stop(); });
test('roles, mandatory selected existing facility and assigned technician enforced', async () => { await get(filters, {}).expect(401); await get(filters, headers('viewer')).expect(403); await get(filters, headers('admin', null)).expect(400); await get(filters, headers('admin', id())).expect(404); await get(filters, headers('technician', other)).expect(403); await get(filters, headers('technician')).expect(200); });
test('completion bounds, archives opt-in, deleted/foreign/unscoped exclusion and independent live backlog', async () => {
  const global = row(); delete global.facilityId;
  await W.collection.insertMany([row({ workOrderNumber: 1, completionDate: new Date('2026-02-01') }), row({ workOrderNumber: 2, completionDate: new Date('2026-02-28T23:59:59.999Z') }), row({ completionDate: new Date('2026-03-01') }), row({ completionDate: null }), row({ workOrderNumber: 3, status: 'Archived' }), row({ deletedAt: new Date() }), row({ facilityId: other }), global, row({ workOrderNumber: 4, status: 'Open', requestDate: new Date('2026-10-01'), completionDate: null })]);
  const before = await W.collection.find().sort({ _id: 1 }).toArray(), r = await get().expect(200);
  expect(r.headers['cache-control']).toBe('no-store'); expect(r.body.activity.rows.map(r => r.number)).toEqual([1, 2]); expect(r.body.backlog.rows.map(r => r.number)).toEqual([4]);
  expect(r.body.backlogBreakdown.map(g => [g.label, g.count])).toEqual([['Open PM', 0], ['Open corrective', 0], ['Other open work', 1]]);
  expect((await get({ ...filters, includeArchived: 'true' }).expect(200)).body.activity.summary.count).toBe(3); expect(await W.collection.find().sort({ _id: 1 }).toArray()).toEqual(before);
});
test('private asset fields and foreign reference labels absent; charts and time reflect captured cohort', async () => {
  const asset = id(); await A.collection.insertOne({ _id: asset, facilityId: other, ctrlNumber: 'PRIVATE-FOREIGN' }); await W.collection.insertOne(row({ assetId: asset, workOrderType: 'PM', timeLogs: [{ timeSpent: 120 }], vendorService: { laborHours: 4 }, costs: { total: 999 } }));
  const r = await get().expect(200); expect(r.body.activity.rows[0].asset).toBeNull(); expect(JSON.stringify(r.body)).not.toContain('PRIVATE-FOREIGN'); expect(r.body.activity.summary).toMatchObject({ laborHours: 2, vendorKnownLaborHours: 4 }); expect(r.body.activity.summary.cost.total).toBeNull(); expect(r.body.charts.completedByType).toEqual([{ label: 'PM', count: 1 }]);
});
test('invalid filters and future month fail closed; errors do not expose database details', async () => { for (const q of [{}, { month: '9999-01' }, { month: ['2026-02', '2026-03'] }, { ...filters, facilityId: String(other) }]) await get(q).expect(400); jest.spyOn(W, 'find').mockImplementation(() => { throw new Error('PRIVATE-DATABASE'); }); const r = await get().expect(503); expect(JSON.stringify(r.body)).not.toContain('PRIVATE-DATABASE'); });
test.each(['Completed', 'Open'])('oversized %s cohort rejects whole report', async status => { await W.collection.insertMany(Array.from({ length: 5001 }, () => row({ status }))); const r = await get().expect(413); expect(r.body).not.toHaveProperty('activity'); expect(r.body).not.toHaveProperty('backlog'); });
