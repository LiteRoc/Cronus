import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

// Permanent accepted-policy regression suite for Gitea #13.
// Actual app registration is evaluated with startup effects disabled; Supplier's
// router, model, JSON parser and authentication implementation remain real.
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const secret = 'synthetic-supplier-regression-only-signing-key';
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

test('configured and alternate database targets fail closed', async () => {
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued by MongoMemoryServer');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued by MongoMemoryServer');
  expect(await Supplier.countDocuments()).toBe(2);
});

test('only collection GET and POST are declared', () => {
  expect(router.stack.filter(layer => layer.route).map(layer => [layer.route.path, Object.keys(layer.route.methods)]))
    .toEqual([['/', ['post']], ['/', ['get']]]);
});

for (const caller of callers) {
  const readAllowed = ['admin', 'technician'].includes(caller);
  const deniedStatus = caller === 'anonymous' ? 401 : 403;
  test(`${caller}: GET enforces the accepted read boundary before querying`, async () => {
    const find = jest.spyOn(Supplier, 'find');
    const response = await request(app).get('/suppliers').set(headers(caller));
    if (readAllowed) {
      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual(ids(seeds));
      expect(response.body.find(row => row.name === seeds[0].name)).toMatchObject({ ...bodyFor(seeds[0].name), status: 'Active' });
    } else {
      expect(response.status).toBe(deniedStatus);
      expect(find).not.toHaveBeenCalled();
      expect(response.body).toEqual({ error: expect.any(String) });
      expect(JSON.stringify(response.body)).not.toContain('Synthetic');
    }
  });
  test(`${caller}: POST enforces admin creation before persistence`, async () => {
    const save = jest.spyOn(Supplier.prototype, 'save');
    const response = await request(app).post('/suppliers').set(headers(caller)).send(bodyFor('Synthetic Created'));
    if (caller === 'admin') {
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Supplier created successfully');
      expect(await Supplier.findById(response.body.supplier._id).lean()).toMatchObject({ ...bodyFor('Synthetic Created'), status: 'Active' });
      expect(await Supplier.countDocuments()).toBe(3);
    } else {
      expect(response.status).toBe(deniedStatus);
      expect(save).not.toHaveBeenCalled();
      expect(response.body).toEqual({ error: expect.any(String) });
      expect(await Supplier.countDocuments()).toBe(2);
    }
  });
  if (caller !== 'admin') test(`${caller}: schema-invalid POST cannot bypass authorization`, async () => {
    const response = await request(app).post('/suppliers').set(headers(caller)).send({ status: 'Unsupported' });
    expect(response.status).toBe(deniedStatus);
    expect(await Supplier.countDocuments()).toBe(2);
  });
}

for (const caller of ['admin', 'technician']) {
  test(`${caller}: shared reads preserve inactive records without Facility or tenant context`, async () => {
    await Supplier.collection.updateOne({ _id: seeds[0]._id }, { $set: { legacySecret: 'synthetic-hidden', tenantId: 'synthetic-owner', createdBy: 'synthetic-actor' } });
    for (const context of [{}, { 'x-facility-id': '000000000000000000000099' }, { 'x-facility-id': 'malformed' }]) {
      const response = await request(app).get('/suppliers').set({ ...headers(caller), ...context })
        .query({ facilityId: '000000000000000000000098', tenantId: '000000000000000000000097', status: 'Active', search: 'no-match', page: 2, limit: 1 }).expect(200);
      expect(ids(response.body)).toEqual(ids(seeds));
      expect(response.body.some(row => row.status === 'Inactive')).toBe(true);
      for (const row of response.body) {
        expect(Object.keys(row).sort()).toEqual(['_id', '__v', 'name', 'contactName', 'contactEmail', 'contactPhone', 'address', 'website', 'status', 'createdAt', 'updatedAt'].sort());
      }
    }
  });
}

test('allowlist preserves every business field, including explicit Inactive status', async () => {
  const input = { ...bodyFor('Synthetic Inactive'), status: 'Inactive' };
  const { body } = await request(app).post('/suppliers').set(headers('admin')).send(input).expect(201);
  expect(body.supplier).toMatchObject(input);
  expect(await Supplier.findById(body.supplier._id).lean()).toMatchObject(input);
});

test('client metadata and ownership cannot override server fields or change existing records', async () => {
  const input = { ...bodyFor('Synthetic Spoof'), _id: String(seeds[0]._id), createdAt: oldDate, updatedAt: oldDate, __v: 99,
    facilityId: '000000000000000000000099', tenantId: '000000000000000000000098', organizationId: '000000000000000000000097',
    createdBy: 'spoof', updatedBy: 'spoof', deletedBy: 'spoof', deletedAt: oldDate, archivedAt: oldDate,
    isNew: false, $set: { name: 'overridden' }, extra: 'discard' };
  const { body } = await request(app).post('/suppliers').set(headers('admin')).send(input).expect(201);
  expect(body.supplier._id).not.toBe(String(seeds[0]._id));
  const stored = await Supplier.collection.findOne({ _id: new mongoose.Types.ObjectId(body.supplier._id) });
  expect(stored.name).toBe('Synthetic Spoof');
  expect(stored.createdAt.toISOString()).not.toBe(oldDate);
  expect(stored.updatedAt.toISOString()).not.toBe(oldDate);
  expect(stored.__v).toBe(0);
  expect(body.supplier).toEqual(JSON.parse(JSON.stringify(stored)));
  expect(body.supplier.createdAt).not.toBe(oldDate);
  expect(body.supplier.updatedAt).not.toBe(oldDate);
  expect(Object.keys(stored).sort()).toEqual(['_id', '__v', 'name', 'contactName', 'contactEmail', 'contactPhone', 'address', 'website', 'status', 'createdAt', 'updatedAt'].sort());
  expect(await Supplier.findById(seeds[0]._id).lean()).toMatchObject({ name: seeds[0].name });
  expect(await Supplier.countDocuments()).toBe(3);
});

for (const [label, body] of [
  ['empty object', {}], ['missing name', { contactName: 'Synthetic' }], ['empty name', { name: '' }],
  ['null name', { name: null }], ['object name', { name: { nested: 'invalid' } }],
  ['array name', { name: ['invalid'] }], ['bad status', { name: 'Synthetic', status: 'Unsupported' }],
  ['object contact email', { name: 'Synthetic', contactEmail: { secret: 'must not leak' } }],
]) test(`safe schema validation: ${label}`, async () => {
  const response = await request(app).post('/suppliers').set(headers('admin')).send(body).expect(400);
  expect(response.body).toEqual({ error: 'Invalid supplier data' });
  expect(await Supplier.countDocuments()).toBe(2);
});

for (const body of ['[]', '[{"name":"Synthetic"}]', 'null', 'true', '42', '"Synthetic"', '{', '{"sensitive":"do not echo",}']) {
  test(`non-object or malformed JSON is a safe 400: ${body}`, async () => {
    const response = await request(app).post('/suppliers').set(headers('admin')).set('Content-Type', 'application/json').send(body).expect(400);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ error: body.startsWith('[') ? 'Invalid supplier body' : 'Invalid JSON body' });
    expect(await Supplier.countDocuments()).toBe(2);
  });
}

test('missing request body is a safe 400 without persistence', async () => {
  const response = await request(app).post('/suppliers').set(headers('admin')).expect(400);
  expect(response.body).toEqual({ error: expect.any(String) });
  expect(await Supplier.countDocuments()).toBe(2);
});

test('malformed JSON is safe for anonymous requests too', async () => {
  const response = await request(app).post('/suppliers').set('Content-Type', 'application/json').send('{').expect(400);
  expect(response.body).toEqual({ error: 'Invalid JSON body' });
  expect(await Supplier.countDocuments()).toBe(2);
});

test('exact duplicate names produce safe 409 using the actual unique index', async () => {
  const response = await request(app).post('/suppliers').set(headers('admin')).send(bodyFor(seeds[0].name)).expect(409);
  expect(response.body).toEqual({ error: 'Supplier name already exists' });
  expect(await Supplier.countDocuments()).toBe(2);
});

test('concurrent exact-name creation has one success and one conflict', async () => {
  const responses = await Promise.all([1, 2].map(() => request(app).post('/suppliers').set(headers('admin')).send(bodyFor('Synthetic Race'))));
  expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
  expect(await Supplier.countDocuments({ name: 'Synthetic Race' })).toBe(1);
});

test('case variants and surrounding whitespace retain exact-name semantics', async () => {
  for (const name of [seeds[0].name.toLowerCase(), ` ${seeds[0].name} `]) {
    const { body } = await request(app).post('/suppliers').set(headers('admin')).send(bodyFor(name)).expect(201);
    expect(body.supplier.name).toBe(name);
  }
  expect(await Supplier.countDocuments()).toBe(4);
});

for (const operation of ['read', 'create']) test(`unexpected ${operation} failures return generic JSON without internals`, async () => {
  const error = new Error('sensitive internal diagnostic must not appear');
  if (operation === 'read') jest.spyOn(Supplier, 'find').mockRejectedValueOnce(error);
  else jest.spyOn(Supplier.prototype, 'save').mockRejectedValueOnce(error);
  const response = operation === 'read'
    ? await request(app).get('/suppliers').set(headers('admin'))
    : await request(app).post('/suppliers').set(headers('admin')).send(bodyFor('Synthetic Failure'));
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: operation === 'read' ? 'Failed to fetch suppliers' : 'Failed to create supplier' });
  expect(await Supplier.countDocuments()).toBe(2);
});

test('non-name duplicate errors are not misclassified as name conflicts', async () => {
  jest.spyOn(Supplier.prototype, 'save').mockRejectedValueOnce({ code: 11000, keyPattern: { _id: 1 }, message: 'internal' });
  const response = await request(app).post('/suppliers').set(headers('admin')).send(bodyFor('Synthetic Failure')).expect(500);
  expect(response.body).toEqual({ error: 'Failed to create supplier' });
  expect(await Supplier.countDocuments()).toBe(2);
});
