import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

// OBSERVATION means reproduced behavior, not approved policy. No production fixes.
// Actual app registration is evaluated with startup effects disabled; Supplier's
// router, model, JSON parser and authentication implementation remain real.
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const secret = 'synthetic-supplier-reproduction-only-signing-key';
const callers = ['anonymous', 'invalid', 'expired', 'admin', 'technician', 'customer', 'viewer', 'tech', 'missing', 'unknown'];
const oldDate = '2001-02-03T04:05:06.000Z';
let harness, app, Supplier, router, auth;
let seeds;
jest.setTimeout(120000);

function headers(caller) {
  if (caller === 'anonymous') return {};
  if (caller === 'invalid') return { Authorization: 'Bearer synthetic-invalid-token' };
  return { Authorization: `Bearer ${jwt.sign({
    sub: '000000000000000000000001',
    ...(caller === 'missing' ? {} : { role: caller === 'expired' ? 'admin' : caller }),
  }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: caller === 'expired' ? -60 : '10m' })}` };
}
const ids = rows => rows.map(row => String(row._id)).sort();
const bodyFor = name => ({ name, contactName: 'Synthetic Contact', contactEmail: 'supplier@example.invalid',
  contactPhone: '+1-202-555-0100', address: 'Synthetic Address', website: 'https://supplier.example.invalid' });

function registeredApplication() {
  const captured = express();
  captured.listen = () => {}; // Never bind the application or execute startup callback.
  const fakeExpress = Object.assign(() => captured, express);
  const fakeRequire = name => {
    if (name === 'express') return fakeExpress;
    if (name === 'path') return path;
    if (name === 'process') return { title: 'synthetic' };
    if (name === 'dotenv') return { config() {} };
    if (name === 'debug') return () => () => {};
    if (name === './src/routers/supplierRouter') return router;
    if (name === './src/middleware/authMiddleware') return auth;
    if (name === './src/middleware/forwardContractHeaders') return { attachContractClient: (_q, _s, next) => next() };
    if (name.includes('/routers/')) {
      const r = express.Router();
      r.vendorJsonErrorHandler = r.contactJsonErrorHandler = r.followUpJsonErrorHandler = r.interactionJsonErrorHandler = (_q, _s, next) => next();
      return r;
    }
    if (name.includes('/models/')) return {};
    if (name === './src/config/db') return () => {};
    if (name === './src/cronJobs/index') return {};
    if (['morgan', 'cors'].includes(name)) return () => (_q, _s, next) => next();
    if (name === 'express-ejs-layouts') return (_q, _s, next) => next();
    throw new Error(`Unexpected startup dependency: ${name}`);
  };
  vm.runInNewContext(readFileSync(new URL('../../../app.js', import.meta.url), 'utf8'), {
    require: fakeRequire, __dirname: '/synthetic-no-public-files', process: { env: {} }, console: { log() {} },
  });
  return captured;
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = secret;
  process.env.JWT_ISS = 'cronus.api';
  process.env.JWT_AUD = 'cronus.app';
  harness = await createIsolatedMongoHarness(mongoose);
  Supplier = requireCore('./src/models/Supplier.js');
  await Supplier.init(); // Exercise the real unique-name index, not validation alone.
  router = requireCore('./src/routers/supplierRouter.js');
  auth = requireCore('./src/middleware/authMiddleware.js');
  app = registeredApplication();
});
beforeEach(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  seeds = await Supplier.create([
    bodyFor('Synthetic Supplier Alpha'),
    { ...bodyFor('Synthetic Supplier Beta'), contactEmail: 'beta@example.invalid', status: 'Inactive' },
  ]);
});
afterEach(async () => {
  if (harness && Supplier) await Supplier.deleteMany({});
  jest.restoreAllMocks();
});
afterAll(async () => { if (harness) await harness.stop(); });

test('CONTROL: configured and alternate database targets fail closed', async () => {
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued by MongoMemoryServer');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued by MongoMemoryServer');
  expect(await Supplier.countDocuments()).toBe(2);
});
test('CONTROL: actual Supplier router declares only collection GET and POST', () => {
  expect(router.stack.map(layer => [layer.route.path, Object.keys(layer.route.methods)])).toEqual([
    ['/', ['post']], ['/', ['get']],
  ]);
});
for (const caller of callers) test(`CONTROL: real authentication middleware recognizes ${caller} fixture`, () => {
  const req = { headers: Object.fromEntries(Object.entries(headers(caller)).map(([k, v]) => [k.toLowerCase(), v])), header: () => undefined };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  auth.authenticateToken(req, res, next);
  if (['anonymous', 'invalid', 'expired'].includes(caller)) {
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(caller === 'anonymous' ? 401 : 403);
  } else {
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.role).toBe(caller === 'missing' ? null : caller);
  }
});

for (const caller of callers) {
  test(`OBSERVATION: ${caller} lists all Suppliers including contacts and metadata`, async () => {
    const { body } = await request(app).get('/suppliers').set(headers(caller)).expect(200);
    expect(ids(body)).toEqual(ids(seeds));
    expect(body.find(row => row.name === seeds[0].name)).toMatchObject({ ...bodyFor(seeds[0].name), status: 'Active', __v: 0 });
    expect(body.every(row => row.createdAt && row.updatedAt)).toBe(true);
    expect(Object.keys(body[0]).sort()).toEqual(['_id', '__v', 'name', 'contactName', 'contactEmail', 'contactPhone', 'address', 'website', 'status', 'createdAt', 'updatedAt'].sort());
  });
  test(`OBSERVATION: ${caller} creates a persisted Supplier`, async () => {
    const { body } = await request(app).post('/suppliers').set(headers(caller)).send(bodyFor('Synthetic Created')).expect(201);
    const stored = await Supplier.findById(body.supplier._id).lean();
    expect(stored).toMatchObject({ ...bodyFor('Synthetic Created'), status: 'Active' });
    expect(await Supplier.countDocuments()).toBe(3);
  });
  test(`CONTROL/OBSERVATION: ${caller} malformed schema body fails without persistence`, async () => {
    for (const body of [{ contactName: 'Synthetic missing name' }, { name: 'Synthetic', status: 'Unsupported' }, { name: { nested: 'bad' } }]) {
      await request(app).post('/suppliers').set(headers(caller)).send(body).expect(500, { error: 'Failed to create supplier' });
      expect(await Supplier.countDocuments()).toBe(2);
    }
  });
  test(`OBSERVATION: ${caller} can supply identity and timestamps`, async () => {
    const id = new mongoose.Types.ObjectId();
    const { body } = await request(app).post('/suppliers').set(headers(caller))
      .send({ name: 'Synthetic Spoof', _id: String(id), createdAt: oldDate, updatedAt: oldDate, __v: 99 }).expect(201);
    const stored = await Supplier.findById(id).lean();
    expect(body.supplier._id).toBe(String(id));
    expect(stored.createdAt.toISOString()).toBe(oldDate);
    expect(stored.updatedAt.toISOString()).toBe(oldDate);
    expect(stored.__v).toBe(0);
  });
  test(`CONTROL/OBSERVATION: ${caller} undeclared ownership and audit fields are stripped`, async () => {
    const fields = Object.fromEntries(['facilityId', 'tenantId', 'organizationId', 'createdBy', 'updatedBy', 'deletedBy'].map(key => [key, '000000000000000000000099']));
    fields.deletedAt = oldDate;
    const { body } = await request(app).post('/suppliers').set(headers(caller)).send({ name: 'Synthetic Fields', ...fields }).expect(201);
    const stored = await Supplier.collection.findOne({ _id: new mongoose.Types.ObjectId(body.supplier._id) });
    for (const key of Object.keys(fields)) {
      expect(stored).not.toHaveProperty(key);
      expect(body.supplier).not.toHaveProperty(key);
    }
    expect(await Supplier.countDocuments()).toBe(3);
  });
  test(`CONTROL/OBSERVATION: ${caller} exact duplicate name fails unique index`, async () => {
    await request(app).post('/suppliers').set(headers(caller)).send(bodyFor(seeds[0].name)).expect(500);
    expect(await Supplier.countDocuments()).toBe(2);
  });
}

test('OBSERVATION: search, status, pagination and ownership query parameters do not restrict results', async () => {
  for (const query of [{ search: 'no-match' }, { status: 'Active' }, { page: 2, limit: 1 },
    { facilityId: '000000000000000000000099', tenantId: '000000000000000000000098' }]) {
    const { body } = await request(app).get('/suppliers').query(query).expect(200);
    expect(ids(body)).toEqual(ids(seeds));
  }
});
test('CONTROL: malformed JSON is rejected by the real app parser without persistence', async () => {
  await request(app).post('/suppliers').set('Content-Type', 'application/json').send('{').expect(400);
  expect(await Supplier.countDocuments()).toBe(2);
});
test('OBSERVATION: case-variant duplicate-like name remains distinct', async () => {
  await request(app).post('/suppliers').send(bodyFor(seeds[0].name.toLowerCase())).expect(201);
  expect(await Supplier.countDocuments()).toBe(3);
});

// Intentionally red boundary assertions. Authenticated role policy is not invented.
for (const caller of ['anonymous', 'invalid', 'expired']) {
  test(`SECURITY: ${caller} must not disclose Supplier records`, async () => {
    const response = await request(app).get('/suppliers').set(headers(caller));
    expect({ denied: [401, 403].includes(response.status), disclosed: Array.isArray(response.body) ? response.body.length : 0 })
      .toEqual({ denied: true, disclosed: 0 });
  });
  test(`SECURITY: ${caller} must not persist Supplier creation`, async () => {
    const response = await request(app).post('/suppliers').set(headers(caller)).send(bodyFor('Synthetic Unauthorized'));
    const persisted = await Supplier.countDocuments({ name: 'Synthetic Unauthorized' });
    expect({ denied: [401, 403].includes(response.status), persisted }).toEqual({ denied: true, persisted: 0 });
  });
}
