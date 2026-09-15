import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const secret = 'synthetic-vendor-security-only';
const actor = '000000000000000000000001';
let app, Vendor, WorkOrder, harness, a, b, router;
jest.setTimeout(120000);
function headers(role = 'admin', claims = {}) {
  if (role === 'anonymous') return {};
  if (role === 'invalid') return { Authorization: 'Bearer invalid-synthetic-token' };
  return { Authorization: `Bearer ${jwt.sign({ sub: actor, ...(role === 'missing' ? {} : { role }), ...claims }, secret,
    { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: role === 'expired' ? '-1s' : '10m' })}` };
}
beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  process.env.JWT_ISS = 'cronus.api';
  process.env.JWT_AUD = 'cronus.app';
  harness = await createIsolatedMongoHarness(mongoose);
  Vendor = requireCore('./src/models/Vendor.js');
  WorkOrder = requireCore('./src/models/WorkOrder.js');
  router = requireCore('./src/routers/vendorRouter.js');
  app = express();
  app.use(express.json());
  app.use('/vendors', router.vendorJsonErrorHandler, router);
});
beforeEach(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  [a, b] = await Vendor.create(['A', 'B'].map(suffix => ({
    name: `Synthetic ${suffix}`, tenantId: new mongoose.Types.ObjectId(), category: 'OEM',
    contactInfo: { primaryContact: 'Public desk', email: 'desk@example.invalid', phone: '555', address: 'Synthetic', website: 'https://example.invalid' },
    services: ['Repair'], territories: ['General'], preferredVendor: true, notes: 'Admin only',
  })));
});
afterEach(async () => {
  jest.restoreAllMocks();
  if (harness) { await Vendor.deleteMany({}); await WorkOrder.deleteMany({}); }
});
afterAll(async () => { if (harness) await harness.stop(); });

for (const role of ['anonymous', 'invalid', 'expired', 'customer', 'viewer', 'tech', 'missing', 'unknown']) {
  for (const operation of ['list', 'detail', 'history', 'create', 'update', 'archive']) {
    test(`${role}: ${operation} denied before policy/mutation`, async () => {
      const method = operation === 'create' ? 'post' : operation === 'update' ? 'put' : operation === 'archive' ? 'delete' : 'get';
      const path = ['list', 'create'].includes(operation) ? '/vendors' : `/vendors/${a._id}${operation === 'history' ? '/history' : ''}`;
      let call = request(app)[method](path).set(headers(role));
      if (['post', 'put'].includes(method)) call = call.send({ name: 'Attack' });
      await call.expect(role === 'anonymous' ? 401 : 403);
      expect(await Vendor.countDocuments()).toBe(2);
      const stored = await Vendor.findById(a._id);
      expect(stored.name).toBe(a.name);
      expect(stored.archivedAt).toBeNull();
    });
  }
}
for (const role of ['admin', 'technician']) {
  for (const endpoint of ['list', 'detail']) {
    test(`${role}: ${endpoint} has only role-appropriate shared fields without tenant context`, async () => {
      const response = await request(app).get(endpoint === 'list' ? '/vendors' : `/vendors/${b._id}`)
        .set(headers(role, { facilityId: String(new mongoose.Types.ObjectId()), facilities: [] }))
        .set('x-facility-id', 'irrelevant-to-shared-master').expect(200);
      const rows = endpoint === 'list' ? response.body : [response.body];
      expect(rows).toHaveLength(endpoint === 'list' ? 2 : 1);
      for (const row of rows) {
        const shared = ['_id', 'name', 'category', 'contactName', 'email', 'phone', 'address', 'website', 'services', 'territories'];
        expect(Object.keys(row).sort()).toEqual([...shared, ...(role === 'admin' ? ['preferredVendor', 'notes'] : [])].sort());
        expect(row.email).toBe('desk@example.invalid');
        if (role === 'admin') expect(row.notes).toBe('Admin only');
      }
    });
  }
}
test('admin creation disabled; no identity or timestamp input is accepted', async () => {
  const { body } = await request(app).post('/vendors').set(headers()).send({ tenantId: b.tenantId, name: 'Attack', createdAt: '2000-01-01' }).expect(409);
  expect(body.error).toMatch(/creation.*unavailable.*normalization/i);
  expect(await Vendor.countDocuments()).toBe(2);
});
for (const method of ['post', 'put', 'delete']) {
  test(`technician ${method} denied`, async () => {
    let call = request(app)[method](method === 'post' ? '/vendors' : `/vendors/${b._id}`).set(headers('technician'));
    if (method !== 'delete') call = call.send({ name: 'Attack' });
    await call.expect(403);
    expect((await Vendor.findById(b._id)).archivedAt).toBeNull();
  });
}
for (const key of ['_id', 'tenantId', 'createdAt', 'updatedAt', 'archivedAt', 'archivedBy', 'createdBy', '__v', 'facilityId', '$unset', 'contactInfo.tenantId']) {
  test(`admin cannot assign protected/unknown field ${key}`, async () => {
    const before = await Vendor.findById(b._id).lean();
    await request(app).put(`/vendors/${b._id}`).set(headers()).send({ [key]: String(new mongoose.Types.ObjectId()) }).expect(400);
    expect(await Vendor.findById(b._id).lean()).toEqual(before);
  });
}
test('admin mutable updates preserve tenant, creation time and other contact fields', async () => {
  const { body } = await request(app).put(`/vendors/${b._id}`).set(headers()).send({
    name: 'Updated', category: 'ISO', contactInfo: { email: 'new@example.invalid' },
    contactName: 'New desk', services: ['Maintenance'], territories: ['Regional'], notes: 'Admin changed', preferredVendor: false,
  }).expect(200);
  expect(body.vendor).toMatchObject({ name: 'Updated', email: 'new@example.invalid', phone: '555', contactName: 'New desk', notes: 'Admin changed', preferredVendor: false });
  expect(body.vendor).not.toHaveProperty('tenantId');
  const stored = await Vendor.findById(b._id);
  expect(stored.tenantId).toEqual(b.tenantId);
  expect(stored.createdAt).toEqual(b.createdAt);
});
for (const payload of [{ category: 'INVALID' }, { name: '' }, { services: [1] }, { preferredVendor: 'true' },
  { contactInfo: { tenantId: 'attack' } }, { contactInfo: { email: 'one' }, email: 'two' }, [], {}, null, { name: { $gt: '' } }]) {
  test(`invalid body ${JSON.stringify(payload)} is safe and does not write`, async () => {
    const before = await Vendor.findById(b._id).lean();
    const { body } = await request(app).put(`/vendors/${b._id}`).set(headers()).set('Content-Type', 'application/json')
      .send(JSON.stringify(payload)).expect(400);
    expect(body).toEqual({ error: 'Invalid Vendor request' });
    expect(await Vendor.findById(b._id).lean()).toEqual(before);
  });
}
for (const method of ['get', 'put', 'delete']) {
  test(`${method} malformed ID is safe`, async () => {
    let call = request(app)[method]('/vendors/bad-id').set(headers());
    if (method === 'put') call = call.send({ name: 'Safe' });
    const { body } = await call.expect(400);
    expect(body).toEqual({ error: 'Invalid Vendor request' });
  });
}
test('malformed JSON returns safe JSON rather than parser internals', async () => {
  const { body } = await request(app).put(`/vendors/${b._id}`).set(headers()).set('Content-Type', 'application/json').send('{broken').expect(400);
  expect(body).toEqual({ error: 'Invalid Vendor request' });
});
test('unexpected database failure returns generic error', async () => {
  jest.spyOn(Vendor, 'find').mockImplementationOnce(() => { throw new Error('synthetic internal detail'); });
  const { body } = await request(app).get('/vendors').set(headers()).expect(500);
  expect(body).toEqual({ error: 'Vendor operation failed' });
});
test('admin archive preserves identity/history and hides active list/detail with no restore', async () => {
  const workId = new mongoose.Types.ObjectId();
  await WorkOrder.collection.insertOne({ _id: workId, vendorService: { vendorId: b._id, vendorName: b.name } });
  await request(app).delete(`/vendors/${b._id}`).set(headers()).expect(200);
  const stored = await Vendor.findById(b._id);
  expect(stored.archivedBy.toString()).toBe(actor);
  expect(stored.archivedAt).toBeInstanceOf(Date);
  expect(stored.tenantId).toEqual(b.tenantId);
  expect(await Vendor.countDocuments()).toBe(2);
  expect((await WorkOrder.findById(workId)).vendorService.vendorId).toEqual(b._id);
  for (const role of ['admin', 'technician']) {
    const { body } = await request(app).get('/vendors?includeArchived=true').set(headers(role)).expect(200);
    expect(body.map(v => v._id)).toEqual([String(a._id)]);
    await request(app).get(`/vendors/${b._id}`).set(headers(role)).expect(404);
    const history = await request(app).get(`/vendors/${b._id}/history`).set(headers(role)).expect(200);
    expect(history.body).toEqual({ _id: String(b._id), name: b.name });
  }
  await request(app).put(`/vendors/${b._id}`).set(headers()).send({ name: 'Restore' }).expect(404);
  await request(app).delete(`/vendors/${b._id}`).set(headers()).expect(404);
  expect((await Vendor.findById(b._id)).archivedAt).toEqual(stored.archivedAt);
});
test('archive audit cannot be spoofed and requires a canonical actor ID', async () => {
  await request(app).delete(`/vendors/${b._id}`).set(headers()).send({ archivedBy: String(a._id) }).expect(400);
  await request(app).delete(`/vendors/${b._id}`).set(headers('admin', { sub: 'invalid-actor' })).expect(403);
  expect((await Vendor.findById(b._id)).archivedAt).toBeNull();
});
test('legacy missing tenant is readable and archivable but cannot be updated or silently repaired', async () => {
  const id = new mongoose.Types.ObjectId();
  await Vendor.collection.insertOne({ _id: id, name: 'Legacy synthetic' });
  await request(app).get(`/vendors/${id}`).set(headers('technician')).expect(200);
  await request(app).put(`/vendors/${id}`).set(headers()).send({ name: 'Changed' }).expect(409);
  await request(app).delete(`/vendors/${id}`).set(headers()).expect(200);
  const stored = await Vendor.collection.findOne({ _id: id });
  expect(stored).not.toHaveProperty('tenantId');
  expect(stored.name).toBe('Legacy synthetic');
  expect(String(stored.archivedBy)).toBe(actor);
  await request(app).get(`/vendors/${id}/history`).set(headers()).expect(200);
});
test('unissued database targets fail closed before connection', async () => {
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued by MongoMemoryServer');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued by MongoMemoryServer');
  expect(await Vendor.countDocuments()).toBe(2);
});

test('malformed percent-encoded ID returns safe JSON', async () => {
  const { body } = await request(app).get('/vendors/%E0%A4%A').set(headers()).expect(400);
  expect(body).toEqual({ error: 'Invalid Vendor request' });
});
test('unknown IDs have safe 404 responses and no restore endpoint is present', async () => {
  const id = new mongoose.Types.ObjectId();
  for (const path of [`/vendors/${id}`, `/vendors/${id}/history`]) {
    const { body } = await request(app).get(path).set(headers()).expect(404);
    expect(body).toEqual({ error: 'Vendor not found' });
  }
  await request(app).put(`/vendors/${id}`).set(headers()).send({ name: 'Unknown' }).expect(404);
  await request(app).delete(`/vendors/${id}`).set(headers()).expect(404);
  await request(app).patch(`/vendors/${b._id}/restore`).set(headers()).expect(404);
});

test('disabled creation still validates body shape after authorization', async () => {
  await request(app).post('/vendors').set(headers()).send([]).expect(400);
  await request(app).post('/vendors').set(headers('technician')).send([]).expect(403);
  expect(await Vendor.countDocuments()).toBe(2);
});
