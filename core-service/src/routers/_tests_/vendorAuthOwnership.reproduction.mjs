import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

// Reproduction only. OBSERVATION assertions document current behavior, not approved policy.
// SECURITY assertions require authentication; they intentionally fail until remediation.
// No application startup, configuration, external clients, or jobs are imported.
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const secret = 'synthetic-vendor-reproduction-signing-key';
let harness, app, Vendor, Facility, Organization, WorkOrder;
let a, b, orgA, orgB, va, vb;
const roles = ['anonymous', 'admin', 'technician', 'customer', 'viewer', 'tech', 'unknown', 'missing', 'invalid'];
jest.setTimeout(120000);
function headers(role = 'technician', selected = a, claims = {}) {
  const result = selected ? { 'x-facility-id': String(selected) } : {};
  if (role === 'anonymous') return result;
  if (role === 'invalid') return { ...result, Authorization: 'Bearer synthetic-invalid-token' };
  return { ...result, Authorization: `Bearer ${jwt.sign({
    sub: '000000000000000000000001', ...(role === 'missing' ? {} : { role }),
    facilityId: String(a), facilities: [String(a)], ...claims,
  }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}` };
}
const ids = rows => rows.map(row => String(row._id)).sort();

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = secret;
  process.env.JWT_ISS = 'cronus.api';
  process.env.JWT_AUD = 'cronus.app';
  harness = await createIsolatedMongoHarness(mongoose);
  Vendor = requireCore('./src/models/Vendor.js');
  Facility = requireCore('./src/models/Facility.js');
  Organization = requireCore('./src/models/Organization.js');
  WorkOrder = requireCore('./src/models/WorkOrder.js');
  app = express();
  app.use(express.json());
  app.use('/vendors', requireCore('./src/routers/vendorRouter.js'));
});
beforeEach(async () => {
  // Existing detail logging is captured locally; never print even synthetic JWT claims.
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  [orgA, orgB] = await Organization.create([{ name: 'Synthetic Org A' }, { name: 'Synthetic Org B' }]);
  const facilities = await Facility.create([
    { name: 'Synthetic Facility A', organizationId: orgA._id },
    { name: 'Synthetic Facility B', organizationId: orgB._id },
  ]);
  [a, b] = facilities.map(f => f._id);
  [va, vb] = await Vendor.create([
    { name: 'Needle A', tenantId: orgA._id, category: 'OEM', contactInfo: { email: 'a@example.invalid' }, notes: 'Synthetic A private note' },
    { name: 'Needle B', tenantId: orgB._id, category: 'ISO', contactInfo: { email: 'b@example.invalid' }, notes: 'Synthetic B private note' },
  ]);
});
afterEach(async () => {
  if (harness) for (const Model of [Vendor, Facility, Organization, WorkOrder]) if (Model) await Model.deleteMany({});
  jest.restoreAllMocks();
});
afterAll(async () => { if (harness) await harness.stop(); });

test('CONTROL: configured and alternate persistence targets fail closed', async () => {
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued by MongoMemoryServer');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued by MongoMemoryServer');
  expect(mongoose.connection.readyState).toBe(1);
  expect(await Vendor.countDocuments()).toBe(2);
});

for (const role of roles) {
  test(`OBSERVATION: ${role} list returns both Organization Vendors and full metadata`, async () => {
    const { body } = await request(app).get('/vendors').set(headers(role)).expect(200);
    expect(ids(body)).toEqual(ids([va, vb]));
    expect(body.find(v => v._id === String(vb._id))).toMatchObject({
      tenantId: String(orgB._id), notes: vb.notes, contactInfo: { email: 'b@example.invalid' },
    });
  });
  test(`CONTROL/OBSERVATION: ${role} detail outcome for owned, foreign, and absent IDs`, async () => {
    for (const id of [va._id, vb._id, new mongoose.Types.ObjectId()]) {
      const status = role === 'anonymous' ? 401 : role === 'invalid' ? 403 : 404;
      const response = await request(app).get(`/vendors/${id}`).set(headers(role)).expect(status);
      if (status === 404) expect(response.body).toEqual({ error: 'Vendor not found' });
    }
  });
  test(`OBSERVATION: ${role} can create in body-selected Organization B`, async () => {
    const { body } = await request(app).post('/vendors').set(headers(role))
      .send({ name: 'Synthetic created', tenantId: String(orgB._id) }).expect(201);
    expect(String((await Vendor.findById(body.vendor._id)).tenantId)).toBe(String(orgB._id));
  });
  test(`OBSERVATION: ${role} can update Organization B Vendor and reassign tenantId`, async () => {
    await request(app).put(`/vendors/${vb._id}`).set(headers(role))
      .send({ name: 'Synthetic changed', tenantId: String(orgA._id) }).expect(200);
    const stored = await Vendor.findById(vb._id);
    expect(stored.name).toBe('Synthetic changed');
    expect(String(stored.tenantId)).toBe(String(orgA._id));
  });
  test(`OBSERVATION: ${role} can hard delete Organization B Vendor`, async () => {
    await request(app).delete(`/vendors/${vb._id}`).set(headers(role)).expect(200);
    expect(await Vendor.findById(vb._id)).toBeNull();
  });
}

for (const context of ['missing', 'conflicting', 'malformed', 'no-default']) {
  test(`OBSERVATION: ${context} Facility context does not constrain list or mutations`, async () => {
    const h = headers('technician', context === 'missing' ? null : context === 'malformed' ? 'bad-id' : b,
      context === 'no-default' ? { facilityId: undefined } : {});
    const { body } = await request(app).get('/vendors').set(h).expect(200);
    expect(ids(body)).toEqual(ids([va, vb]));
    await request(app).post('/vendors').set(h).send({ name: 'Synthetic context', tenantId: orgB._id }).expect(201);
    await request(app).put(`/vendors/${vb._id}`).set(h).send({ notes: 'Synthetic context change' }).expect(200);
    await request(app).delete(`/vendors/${vb._id}`).set(h).expect(200);
  });
}

test('OBSERVATION: search, filters, count and pagination parameters are ignored', async () => {
  for (const query of [{ search: 'absent' }, { q: 'absent' }, { category: 'OEM', tenantId: String(orgA._id) },
    { facilityId: String(a), page: 2, limit: 1 }, { search: 'Needle', category: 'OEM', page: 99, limit: 1 }]) {
    const { body } = await request(app).get('/vendors').set(headers()).query(query).expect(200);
    expect(ids(body)).toEqual(ids([va, vb]));
    expect(Array.isArray(body)).toBe(true);
  }
});
test('OBSERVATION: even a signed tenantId claim is discarded before detail lookup', async () => {
  await request(app).get(`/vendors/${va._id}`).set(headers('admin', a, { tenantId: String(orgA._id) })).expect(404);
});
test('OBSERVATION: ownership-free legacy fixture is returned to every signed role', async () => {
  const legacy = { _id: new mongoose.Types.ObjectId(), name: 'Synthetic legacy', notes: 'Synthetic legacy detail' };
  await Vendor.collection.insertOne(legacy); // deliberate legacy shape, not evidence that real data has it
  for (const role of roles.filter(role => !['anonymous', 'invalid'].includes(role))) {
    const { body } = await request(app).get(`/vendors/${legacy._id}`).set(headers(role)).expect(200);
    expect(body.notes).toBe(legacy.notes);
  }
});
test('OBSERVATION: create accepts arbitrary tenant and supplied ID/timestamp, strips absent-schema audit/Facility fields', async () => {
  const id = new mongoose.Types.ObjectId();
  const tenant = new mongoose.Types.ObjectId();
  const { body } = await request(app).post('/vendors').send({
    _id: id, name: 'Synthetic spoof', tenantId: tenant, facilityId: b, organizationId: orgB._id,
    createdBy: new mongoose.Types.ObjectId(), updatedBy: new mongoose.Types.ObjectId(),
    createdAt: '2001-01-01T00:00:00.000Z',
  }).expect(201);
  expect(body.vendor._id).toBe(String(id));
  expect(body.vendor.tenantId).toBe(String(tenant));
  expect(body.vendor.createdAt).toBe('2001-01-01T00:00:00.000Z');
  for (const key of ['facilityId', 'organizationId', 'createdBy', 'updatedBy']) expect(body.vendor).not.toHaveProperty(key);
});
test('CONTROL: create without required tenantId fails validation', async () => {
  await request(app).post('/vendors').send({ name: 'Synthetic missing tenant' }).expect(400);
  expect(await Vendor.countDocuments()).toBe(2);
});
test('OBSERVATION: duplicate names across and within tenants are accepted without duplicate disclosure', async () => {
  for (const tenantId of [orgA._id, orgB._id]) {
    const { body } = await request(app).post('/vendors').set(headers()).send({ name: vb.name, tenantId }).expect(201);
    expect(body).not.toHaveProperty('duplicateOf');
    expect(body.vendor._id).not.toBe(String(vb._id));
  }
});
test('OBSERVATION: update operators can remove required ownership and bypass category validation', async () => {
  await request(app).put(`/vendors/${vb._id}`).send({ $unset: { tenantId: 1 }, $set: { category: 'InvalidSyntheticCategory' } }).expect(200);
  const stored = await Vendor.findById(vb._id).lean();
  expect(stored).not.toHaveProperty('tenantId');
  expect(stored.category).toBe('InvalidSyntheticCategory');
  await request(app).get(`/vendors/${vb._id}`).set(headers('viewer')).expect(200);
});
test('OBSERVATION: deletion leaves an existing WorkOrder reference dangling', async () => {
  const id = new mongoose.Types.ObjectId();
  await WorkOrder.collection.insertOne({ _id: id, facilityId: b, vendorService: { vendorId: vb._id, vendorName: vb.name } });
  await request(app).delete(`/vendors/${vb._id}`).expect(200);
  const stored = await WorkOrder.findById(id).lean();
  expect(String(stored.vendorService.vendorId)).toBe(String(vb._id));
  expect(await Vendor.findById(stored.vendorService.vendorId)).toBeNull();
});
test('OBSERVATION: missing mutation IDs disclose absence; malformed IDs return casting errors', async () => {
  const absent = new mongoose.Types.ObjectId();
  await request(app).put(`/vendors/${absent}`).send({ name: 'Synthetic' }).expect(404);
  await request(app).delete(`/vendors/${absent}`).expect(404);
  await request(app).get('/vendors/bad-id').set(headers()).expect(500);
  const { body } = await request(app).put('/vendors/bad-id').send({ name: 'Synthetic' }).expect(400);
  expect(body.details).toContain('Cast to ObjectId failed');
});
test('CONTROL: no PATCH/archive or singular create endpoint is mounted', async () => {
  await request(app).patch(`/vendors/${va._id}`).send({ name: 'Synthetic' }).expect(404);
  await request(app).patch(`/vendors/${va._id}/archive`).expect(404);
  await request(app).post('/vendor').send({ name: 'Synthetic' }).expect(404);
});

for (const role of ['anonymous', 'invalid']) {
  for (const method of ['get', 'post', 'put', 'delete']) {
    test(`SECURITY: ${role} ${method.toUpperCase()} must require valid authentication`, async () => {
      const path = ['put', 'delete'].includes(method) ? `/vendors/${vb._id}` : '/vendors';
      let call = request(app)[method](path).set(headers(role));
      if (['post', 'put'].includes(method)) call = call.send({ name: 'Synthetic attack', tenantId: orgB._id });
      const response = await call;
      expect([401, 403]).toContain(response.status);
      if (method !== 'get') {
        expect(await Vendor.countDocuments()).toBe(2);
        expect((await Vendor.findById(vb._id)).name).toBe(vb.name);
      }
    });
  }
}

for (const [field, update] of [
  ['tenantId', { $unset: { tenantId: 1 } }],
  ['category', { $set: { category: 'InvalidSyntheticCategory' } }],
]) {
  test(`SECURITY: PUT must preserve existing schema invariant for ${field}`, async () => {
    await request(app).put(`/vendors/${vb._id}`).set(headers('admin')).send(update);
    const stored = await Vendor.findById(vb._id).lean();
    // Required ownership and category enum are declared in the current schema;
    // this does not invent a Facility/global access policy or require a particular status.
    expect(stored[field]).toEqual(vb.toObject()[field]);
  });
}
