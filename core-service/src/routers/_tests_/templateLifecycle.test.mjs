import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const m = requireCore('mongoose'), axios = requireCore('axios');
const actor = '000000000000000000000001', spoof = '000000000000000000000002', facility = '000000000000000000000003';
const old = '2001-02-03T04:05:06.000Z', secret = 'synthetic-template-lifecycle';
let h, app, T, A, F, W, lifecycle, adapter, providerCalls, providerReply;
const oid = () => new m.Types.ObjectId();
const payload = (extra = {}) => ({ manufacturer: 'Synthetic maker', model: 'Synthetic model', description: 'Synthetic', equipmentClass: 'Class II', ...extra });
const seed = (extra = {}) => T.create(payload(extra));
const stored = d => T.collection.findOne({ _id: d._id });
const snapshot = async d => JSON.stringify(await stored(d));
const headers = (role = 'technician', context = true) => role === 'anonymous' ? {} : ({
  Authorization: `Bearer ${jwt.sign({ sub: actor, ...(role === 'missing' ? {} : { role }), ...(context ? { facilityId: facility, facilities: [facility] } : {}) }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`,
  ...(context ? { 'x-facility-id': facility } : {}),
});
const send = (method, url, data, role = 'technician', context = true) => request(app)[method](url).set(headers(role, context)).send(data);
const archive = d => send('patch', `/templates/${d.id}/archive`, {}, 'admin').expect(200);
const asset = (extra = {}) => A.create({ ctrlNumber: 'SYNTHETIC', manufacturer: 'Synthetic', model: 'Device', facilityId: facility, ...extra });

// Evaluate real mount declarations without executing deployment startup or cron.
function mountedApp() {
  const captured = express(); captured.listen = () => {};
  const routers = Object.fromEntries(['templates', 'assets', 'workOrder', 'dashboard'].map(n => [`./src/routers/${n}Router`, requireCore(`./src/routers/${n}Router`)]));
  const fakeRequire = name => {
    if (name === 'express') return Object.assign(() => captured, express);
    if (name === 'path') return path;
    if (name === 'process') return { title: 'synthetic' };
    if (name === 'dotenv') return { config() {} };
    if (name === 'debug') return () => () => {};
    if (routers[name]) return routers[name];
    if (name === './src/middleware/authMiddleware') return requireCore(name);
    if (name === './src/middleware/forwardContractHeaders') return { attachContractClient: (_q, _s, next) => next() };
    if (name.includes('/routers/')) {
      const r = express.Router(); r.vendorJsonErrorHandler = r.supplierJsonErrorHandler = r.contactJsonErrorHandler = r.followUpJsonErrorHandler = (_q, _s, next) => next(); return r;
    }
    if (name.includes('/models/')) return {};
    if (name === './src/config/db') return () => {};
    if (name === './src/cronJobs/index') return {};
    if (['morgan', 'cors'].includes(name)) return () => (_q, _s, next) => next();
    if (name === 'express-ejs-layouts') return (_q, _s, next) => next();
    throw Error(`Unexpected startup dependency ${name}`);
  };
  vm.runInNewContext(readFileSync(new URL('../../../app.js', import.meta.url), 'utf8'), { require: fakeRequire, __dirname: '/synthetic-no-public-files', process: { env: {} }, console: { log() {} } });
  return captured;
}
jest.setTimeout(120000);
beforeAll(async () => {
  process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = secret; process.env.JWT_ISS = 'cronus.api'; process.env.JWT_AUD = 'cronus.app'; process.env.FDA_GUDID_BASE = 'http://synthetic-provider.invalid';
  // Baseline has an unsupported partial index. Do not change deployed indexes;
  // explicitly install the supported DI uniqueness index in this isolated DB.
  m.set('autoIndex', false);
  h = await createIsolatedMongoHarness(m);
  T = requireCore('./src/models/EquipmentTemplate'); A = requireCore('./src/models/Asset'); F = requireCore('./src/models/Facility'); W = requireCore('./src/models/WorkOrder');
  lifecycle = requireCore('./src/services/templateLifecycle');
  await T.collection.createIndex({ di: 1 }, { unique: true, sparse: true });
  adapter = axios.defaults.adapter;
  axios.defaults.adapter = async config => {
    if (config.url !== 'http://synthetic-provider.invalid/devices/lookup.json') throw Error('Unexpected external request refused');
    providerCalls++;
    return { data: providerReply || { device: { di: config.params.di, companyName: 'Synthetic provider', versionModelNumber: 'Synthetic provider model', deviceDescription: 'Synthetic refreshed description' } }, status: 200, statusText: 'OK', headers: {}, config };
  };
  app = mountedApp();
});
beforeEach(async () => {
  for (const method of ['log', 'warn', 'error', 'dir']) jest.spyOn(console, method).mockImplementation(() => {});
  providerCalls = 0; providerReply = null;
  await F.collection.insertOne({ _id: new m.Types.ObjectId(facility), name: 'Synthetic Facility' });
});
afterEach(async () => {
  jest.restoreAllMocks();
  if (h) await Promise.all([T, A, F, W].map(Model => Model.deleteMany({})));
});
afterAll(async () => { axios.defaults.adapter = adapter; if (h) await h.stop(); });

test('configured and alternate MongoDB targets are refused', async () => {
  await expect(m.connect(process.env.MONGO_URI)).rejects.toThrow('not issued');
  await expect(m.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued');
});
for (const role of ['anonymous', 'customer', 'viewer', 'tech', 'missing', 'unknown']) test(`${role}: all Template reads and writes enforce the canonical role boundary`, async () => {
  const d = await seed({ di: '00000000000001' }), before = await snapshot(d), expected = role === 'anonymous' ? 401 : 403;
  for (const [method, url, body] of [
    ['get', '/templates'], ['get', `/templates/${d.id}`], ['get', '/templates/distinct/manufacturers'],
    ['get', '/templates/distinct/models?manufacturer=Synthetic'], ['get', `/templates/${d.id}/lifecycle`],
    ['post', '/templates', payload()], ['put', `/templates/${d.id}`, { description: 'Changed' }],
    ['patch', `/templates/${d.id}/archive`, {}], ['patch', `/templates/${d.id}/achive`, {}],
    ['patch', `/templates/${d.id}/sync-gudid`, {}], ['post', '/templates/from-di', { di: d.di }],
    ['post', '/templates/from-di-or-udi', { di: d.di }],
  ]) await send(method, url, body, role).expect(expected);
  expect(await snapshot(d)).toBe(before); expect(providerCalls).toBe(0);
});
for (const role of ['admin', 'technician']) test(`${role}: active shared reads and ordinary business updates work without Facility context`, async () => {
  const d = await seed();
  await send('get', '/templates', undefined, role, false).expect(200);
  await send('get', `/templates/${d.id}`, undefined, role, false).expect(200);
  await send('get', '/templates/distinct/manufacturers', undefined, role, false).expect(200);
  await send('get', `/templates/distinct/models?manufacturer=${encodeURIComponent(d.manufacturer)}`, undefined, role, false).expect(200);
  const r = await send('put', `/templates/${d.id}`, { description: 'Changed', lifecycleDefaults: { expectedLifeYears: 10 }, benchmark: { confidence: 'high' }, isTestEquipment: true }, role, false).expect(200);
  expect(r.body.template.description).toBe('Changed'); expect(r.body.template.updatedBy).toBe(actor);
  expect((await stored(d)).lifecycleDefaults.expectedLifeYears).toBe(10);
});
test('manual create remains admin-only and assigns server provenance', async () => {
  await send('post', '/templates', payload()).expect(403);
  const r = await send('post', '/templates', payload(), 'admin', false).expect(201);
  expect(r.body.template).toMatchObject({ status: 'Active', verified: false, createdBy: actor, updatedBy: actor, deletedAt: null, deletedBy: null });
  expect(r.body.template.createdAt).toBeTruthy(); expect(r.body.template).not.toHaveProperty('templateReferenceReservation');
});
const protectedFields = ['_id', '__v', 'status', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'deletedAt', 'deletedBy', 'archivedAt', 'archivedBy', 'isArchived', 'verified', 'verifiedAt', 'verifiedBy', 'verificationSource', 'duplicateOf', 'templateReferenceReservation', 'facilityId'];
for (const key of protectedFields) for (const role of ['admin', 'technician']) test(`${role}: protected ${key} rejected on ordinary create/update without writes`, async () => {
  const d = await seed(), before = await snapshot(d);
  const value = key.endsWith('At') ? old : key === 'status' ? 'Archived' : key === 'verified' || key === 'isArchived' ? true : spoof;
  await send('post', '/templates', payload({ [key]: value }), role).expect(role === 'admin' ? 400 : 403);
  await send('put', `/templates/${d.id}`, { [key]: value }, role).expect(400);
  expect(await T.countDocuments()).toBe(1); expect(await snapshot(d)).toBe(before);
});
for (const body of [[], [{ $set: { status: 'Active', deletedAt: null, createdBy: spoof } }], { $unset: { status: 1 } }, { $set: { deletedAt: null } }, { 'benchmark.confidence': 'high' }, { benchmark: { $set: { confidence: 'high' } } }, { lifecycleDefaults: { deletedAt: old } }, { constructor: { prototype: {} } }]) test(`operators, pipelines and nested protected input rejected: ${JSON.stringify(body)}`, async () => {
  const d = await seed(); await archive(d); const before = await snapshot(d);
  await send('put', `/templates/${d.id}`, body).expect(400);
  await send('post', '/templates', body, 'admin').expect(400);
  expect(await snapshot(d)).toBe(before); expect(await T.countDocuments()).toBe(1);
});
for (const body of [{ manufacturer: null }, { lifecycleDefaults: { expectedLifeYears: -1 } }, { benchmark: { confidence: 'UNDECLARED' } }, { benchmark: { expectedUsefulLifeYears: -1 } }, { eolYears: 'not-a-number' }]) test(`business update validates ${JSON.stringify(body)}`, async () => {
  const d = await seed(), before = await snapshot(d);
  await send('put', `/templates/${d.id}`, body).expect(400); expect(await snapshot(d)).toBe(before);
});
for (const archived of [{ status: 'Archived' }, { deletedAt: new Date(old) }, { deletedBy: new m.Types.ObjectId(spoof) }, { archivedAt: new Date(old) }, { archivedBy: new m.Types.ObjectId(spoof) }, { isArchived: true }]) test(`legacy archive marker ${Object.keys(archived)[0]} blocks every new reference and mutation but retains history`, async () => {
  const d = await seed({ di: '00000000000001', isTestEquipment: true, lifecycleDefaults: { expectedLifeYears: 9 }, ...archived });
  const history = await asset({ templateId: d._id, assignedTo: actor }), unrelated = await asset({ ctrlNumber: 'UNRELATED' });
  const before = await snapshot(d);
  for (const role of ['admin', 'technician']) {
    await send('put', `/templates/${d.id}`, { description: 'Forbidden' }, role).expect(409);
    await send('put', `/templates/${d.id}`, { status: 'Active' }, role).expect(400);
    await send('patch', `/templates/${d.id}/sync-gudid`, {}, role).expect(409);
    await send('post', '/templates/from-di', { di: d.di }, role).expect(409);
    await send('post', '/templates/from-di-or-udi', { udi: `(01)${d.di}` }, role).expect(409);
    await send('post', '/templates/from-di-or-udi', { di: d.di, createAsset: true, asset: { ctrlNumber: 'NEW' } }, role).expect(409);
    await send('post', '/assets', { ctrlNumber: 'NEW', templateId: d.id }, role).expect(409);
    await send('put', `/assets/${unrelated.id}`, { templateId: d.id }, role).expect(409);
  }
  expect(providerCalls).toBe(0); expect(await snapshot(d)).toBe(before); expect(await A.countDocuments()).toBe(2);
  const list = await send('get', '/templates').expect(200); expect(list.body.templates).toEqual([]); expect(list.body.totalCount).toBe(0);
  expect((await send('get', '/templates/distinct/manufacturers').expect(200)).body).toEqual([]);
  expect((await send('get', `/templates/distinct/models?manufacturer=${encodeURIComponent(d.manufacturer)}`).expect(200)).body).toEqual([]);
  await send('get', `/templates/${d.id}`).expect(200);
  expect((await send('get', `/assets/${history.id}`).expect(200)).body.templateId._id).toBe(d.id);
  expect((await send('post', '/assets/batch', { assetIds: [history.id] }).expect(200)).body.assets[0].templateId._id).toBe(d.id);
  expect((await send('get', `/assets/${history.id}/lifecycle`).expect(200)).body.templateId).toBe(d.id);
  expect((await send('get', `/templates/${d.id}/lifecycle`).expect(200)).body.summary.totalAssets).toBe(1);
  expect((await send('get', '/assets/test-equipment').expect(200)).body.map(x => x._id)).toContain(history.id);
  await send('put', `/assets/${history.id}`, { templateId: d.id, description: 'Unchanged historical link' }).expect(200);
  await archive(d); expect(await snapshot(d)).toBe(before); // Never invent legacy provenance.
  const created = await send('post', '/templates', payload({ di: '00000000000002' }), 'admin').expect(201);
  expect(created.body.template.duplicateOf).toBeNull(); // Archived duplicate candidates excluded.
});
test('archive is admin-only, consistent, idempotent through canonical and legacy paths', async () => {
  const d = await seed();
  for (const suffix of ['archive', 'achive']) await send('patch', `/templates/${d.id}/${suffix}`, {}).expect(403);
  await archive(d); const s = await stored(d);
  expect(s.status).toBe('Archived'); expect(String(s.deletedBy)).toBe(actor); expect(s.deletedAt).toBeInstanceOf(Date); expect(String(s.updatedBy)).toBe(actor);
  const before = await snapshot(d);
  await send('patch', `/templates/${d.id}/achive`, {}, 'admin').expect(200); await archive(d);
  expect(await snapshot(d)).toBe(before);
  await send('delete', `/templates/${d.id}`, {}, 'admin').expect(404);
});
test('legacy missing status/metadata remains shared and usable', async () => {
  const id = oid(); await T.collection.insertOne({ _id: id, manufacturer: 'Legacy', model: 'Synthetic' });
  const r = await send('post', '/assets', { ctrlNumber: 'LEGACY', templateId: String(id) }).expect(201); expect(r.body.asset.templateId).toBe(String(id));
});
for (const route of ['from-di', 'from-di-or-udi']) test(`${route}: provider-only verification, valid create/update and no resurrection`, async () => {
  const r = await send('post', `/templates/${route}`, { di: '00000000000001' }, 'technician', false).expect(201);
  const d = await T.findById(r.body.template._id);
  expect(r.body.template).toMatchObject({ verified: true, verifiedBy: actor, verificationSource: 'AccessGUDID', status: 'Active' });
  expect(r.body.template.verifiedAt).toBeTruthy(); expect(r.body.template).not.toHaveProperty('facilityId');
  await send('post', `/templates/${route}`, { di: d.di }).expect(201); expect(await T.countDocuments()).toBe(1);
  await archive(d); const before = await snapshot(d); await send('post', `/templates/${route}`, { di: d.di }).expect(409); expect(await snapshot(d)).toBe(before);
});
for (const route of ['from-di', 'from-di-or-udi']) for (const key of ['status', 'verified', 'verifiedBy', 'createdBy', 'deletedAt', 'duplicateOf']) test(`${route}: rejects caller ${key} before provider`, async () => {
  await send('post', `/templates/${route}`, { di: '00000000000001', [key]: spoof }).expect(400); expect(providerCalls).toBe(0); expect(await T.countDocuments()).toBe(0);
});
test('provider refresh preserves verification; ordinary changed FDA data invalidates it, benchmark edits do not', async () => {
  const d = await seed({ di: '00000000000001' });
  await send('patch', `/templates/${d.id}/sync-gudid`, {}).expect(200);
  const verified = await stored(d);
  await send('put', `/templates/${d.id}`, { benchmark: { confidence: 'high' } }).expect(200);
  expect((await stored(d)).verifiedAt).toEqual(verified.verifiedAt);
  await send('put', `/templates/${d.id}`, { description: 'Manual correction' }).expect(200);
  const edited = await stored(d); expect(edited.verified).toBe(false); expect(edited.verifiedAt).toBeNull(); expect(edited.verifiedBy).toBeNull(); expect(edited.verificationSource).toBeNull();
  await send('patch', `/templates/${d.id}/sync-gudid`, { verifiedBy: spoof }).expect(400);
});
test('duplicate references are server-derived and historical duplicate remains resolvable', async () => {
  const d = await seed({ di: '00000000000001' });
  const r = await send('post', '/templates', payload({ di: '00000000000002' }), 'admin').expect(201);
  expect(r.body.template.duplicateOf).toBe(d.id); expect(await stored(d)).not.toHaveProperty('templateReferenceReservation');
  await archive(d);
  expect((await T.findById(r.body.template._id).populate('duplicateOf')).duplicateOf.id).toBe(d.id);
  await send('post', '/templates', payload({ di: '00000000000003', duplicateOf: d.id }), 'admin').expect(400);
  await send('put', `/templates/${r.body.template._id}`, { duplicateOf: d.id }).expect(400);
});
test('established archived-Template test equipment remains usable on a WorkOrder', async () => {
  const d = await seed({ isTestEquipment: true });
  const a = await asset({ templateId: d._id, assignedTo: actor });
  const w = await W.create({ facilityId: facility, assetId: a._id, description: 'Synthetic', workOrderNumber: 1 });
  await archive(d);
  await send('post', `/workorders/${w.id}/test-equipment`, { equipmentId: a.id }).expect(200);
  expect(String((await W.findById(w.id)).testEquipmentUsed[0].equipmentId)).toBe(a.id);
});
test('lifecycle selected Facility requirement remains enforced for authorized roles', async () => {
  const d = await seed();
  await send('get', `/templates/${d.id}/lifecycle`, undefined, 'technician', false).expect(400);
  await request(app).get(`/templates/${d.id}/lifecycle`).set(headers()).set('x-facility-id', String(oid())).expect(403);
});
test('invalid and absent mutation IDs fail safely', async () => {
  for (const [value, status] of [['bad-id', 400], [String(oid()), 404]]) {
    await send('put', `/templates/${value}`, { description: 'Synthetic' }).expect(status);
    await send('patch', `/templates/${value}/archive`, {}, 'admin').expect(status);
    await send('patch', `/templates/${value}/sync-gudid`, {}).expect(status);
  }
});

test('archive wins between ordinary update read and write', async () => {
  const d = await seed(); const validate = T.prototype.validate;
  jest.spyOn(T.prototype, 'validate').mockImplementationOnce(async function (...args) { await archive(d); return validate.apply(this, args); });
  await send('put', `/templates/${d.id}`, { description: 'Forbidden stale edit' }).expect(409);
  expect((await stored(d)).description).toBe('Synthetic');
});
for (const op of ['create', 'update', 'udi']) test(`archive wins before ${op} new reference reservation`, async () => {
  const d = await seed({ di: '00000000000001' }), a = await asset();
  const original = lifecycle.withReference;
  jest.spyOn(lifecycle, 'withReference').mockImplementationOnce(async (...args) => { await archive(d); return original(...args); });
  if (op === 'create') await send('post', '/assets', { templateId: d.id, ctrlNumber: 'NEW' }).expect(409);
  if (op === 'update') await send('put', `/assets/${a.id}`, { templateId: d.id }).expect(409);
  if (op === 'udi') await send('post', '/templates/from-di-or-udi', { di: d.di, createAsset: true, asset: { ctrlNumber: 'NEW' } }).expect(409);
  expect(await A.countDocuments({ templateId: d._id })).toBe(0);
});
test('new reference reservation blocks archive until the write completes; no metadata leaks', async () => {
  const d = await seed(), create = A.create.bind(A);
  jest.spyOn(A, 'create').mockImplementationOnce(async (...args) => {
    await send('patch', `/templates/${d.id}/archive`, {}, 'admin').expect(409);
    expect((await send('get', `/templates/${d.id}`).expect(200)).body).not.toHaveProperty('templateReferenceReservation');
    return create(...args);
  });
  await send('post', '/assets', { templateId: d.id, ctrlNumber: 'NEW' }).expect(201);
  expect(await stored(d)).not.toHaveProperty('templateReferenceReservation'); await archive(d);
});
test('uncertain dependent write retains reservation and blocks archive and new reference', async () => {
  const d = await seed(); jest.spyOn(A, 'create').mockRejectedValueOnce(Error('Synthetic uncertain acknowledgement'));
  await send('post', '/assets', { templateId: d.id, ctrlNumber: 'NEW' }).expect(500);
  const token = (await stored(d)).templateReferenceReservation.token;
  await send('patch', `/templates/${d.id}/archive`, {}, 'admin').expect(409);
  await send('post', '/assets', { templateId: d.id, ctrlNumber: 'RETRY' }).expect(409);
  expect((await stored(d)).templateReferenceReservation.token).toBe(token);
});
test('definitive validation failure releases reservation without changing Template audit', async () => {
  const d = await seed(), before = await snapshot(d);
  await send('post', '/assets', { templateId: d.id, ctrlNumber: 'NEW', relationToParent: 'invalid-enum' }).expect(400);
  expect(await snapshot(d)).toBe(before); await archive(d);
});
test('stale unchanged historical Asset reference cannot undo concurrent unlink', async () => {
  const d = await seed(), a = await asset({ templateId: d._id }); await archive(d);
  const save = A.prototype.save;
  jest.spyOn(A.prototype, 'save').mockImplementationOnce(async function (...args) {
    await A.collection.updateOne({ _id: a._id }, { $set: { templateId: null } });
    return save.apply(this, args);
  });
  await send('put', `/assets/${a.id}`, { templateId: d.id, description: 'Stale' }).expect(409);
  expect((await A.findById(a.id)).templateId).toBeNull();
});

test('archive during provider lookup prevents stale refresh and DI resurrection', async () => {
  const d = await seed({ di: '00000000000001' }), get = axios.get.bind(axios);
  jest.spyOn(axios, 'get').mockImplementationOnce(async (...args) => { await archive(d); return get(...args); });
  await send('post', '/templates/from-di', { di: d.di }).expect(409);
  expect((await stored(d)).status).toBe('Archived'); expect((await stored(d)).manufacturer).toBe('Synthetic maker');
});
test('provider duplicate discovery skips archives and preserves an unchanged historical duplicate', async () => {
  const d = await seed({ di: '00000000000002', manufacturer: 'Synthetic provider', model: 'Synthetic provider model' }); await archive(d);
  const created = await send('post', '/templates/from-di', { di: '00000000000001' }).expect(201);
  expect(created.body.template.duplicateOf).toBeNull();
  await T.collection.updateOne({ _id: new m.Types.ObjectId(created.body.template._id) }, { $set: { duplicateOf: d._id } });
  const synced = await send('patch', `/templates/${created.body.template._id}/sync-gudid`, {}).expect(200);
  expect(synced.body.template.duplicateOf).toBe(d.id);
});
test('duplicate reference reservation blocks archive until manual Template creation finishes', async () => {
  const d = await seed({ di: '00000000000001' }), save = T.prototype.save;
  jest.spyOn(T.prototype, 'save').mockImplementationOnce(async function (...args) {
    await send('patch', `/templates/${d.id}/archive`, {}, 'admin').expect(409);
    return save.apply(this, args);
  });
  const r = await send('post', '/templates', payload({ di: '00000000000002' }), 'admin').expect(201);
  expect(r.body.template.duplicateOf).toBe(d.id); expect(await stored(d)).not.toHaveProperty('templateReferenceReservation'); await archive(d);
});
test('archive between duplicate discovery and reservation blocks new duplicate reference', async () => {
  const d = await seed({ di: '00000000000001' }), validate = T.prototype.validate;
  jest.spyOn(T.prototype, 'validate').mockImplementationOnce(async function (...args) { await archive(d); return validate.apply(this, args); });
  await send('post', '/templates', payload({ di: '00000000000002' }), 'admin').expect(409);
  expect(await T.countDocuments()).toBe(1);
});
test('lost reference acquisition acknowledgement retains reservation before any dependent write', async () => {
  const d = await seed(), update = T.findOneAndUpdate.bind(T);
  jest.spyOn(T, 'findOneAndUpdate').mockImplementationOnce(async (...args) => { await update(...args); throw Error('Synthetic lost acquire acknowledgement'); });
  await send('post', '/assets', { templateId: d.id, ctrlNumber: 'NEW' }).expect(500);
  expect(await A.countDocuments()).toBe(0); expect((await stored(d)).templateReferenceReservation.token).toBeTruthy();
  await send('patch', `/templates/${d.id}/archive`, {}, 'admin').expect(409);
});
test('lost dependent commit acknowledgement retains reservation even when reference exists', async () => {
  const d = await seed(), create = A.create.bind(A);
  jest.spyOn(A, 'create').mockImplementationOnce(async (...args) => { await create(...args); throw Error('Synthetic lost commit acknowledgement'); });
  await send('post', '/assets', { templateId: d.id, ctrlNumber: 'NEW' }).expect(500);
  expect(await A.countDocuments({ templateId: d._id })).toBe(1); expect((await stored(d)).templateReferenceReservation.token).toBeTruthy();
  await send('patch', `/templates/${d.id}/archive`, {}, 'admin').expect(409);
});

for (const field of ["deletedAt", "deletedBy", "archivedAt", "archivedBy", "isArchived"]) {
  for (const value of [[null, spoof], [null], [spoof], [], {}, "invalid-legacy", 0, false]) {
    test(`malformed archive ${field}=${JSON.stringify(value)} fails closed consistently`, async () => {
      const id = oid();
      await T.collection.insertOne({ _id: id, ...payload(), [field]: value });
      const d = await T.findById(id), raw = await stored(d), before = JSON.stringify(raw);
      expect(lifecycle.isArchived(raw)).toBe(true); expect(lifecycle.isArchived(d)).toBe(true);
      expect(await T.countDocuments({ _id: id, ...lifecycle.activeFilter() })).toBe(0);
      await send("post", "/assets", { ctrlNumber: "MALFORMED", templateId: String(id) }).expect(409);
      await expect(lifecycle.withReference(id, "synthetic-review", oid(), () => { throw Error("must not write"); })).rejects.toMatchObject({ status: 409 });
      await send("put", `/templates/${id}`, { description: "Forbidden" }).expect(409);
      await send("patch", `/templates/${id}/sync-gudid`, {}).expect(409);
      await archive(d); expect(await snapshot(d)).toBe(before);
      expect((await send("get", "/templates").expect(200)).body.templates).toEqual([]);
      expect((await send("get", "/templates/distinct/manufacturers").expect(200)).body).toEqual([]);
      const historical = await asset({ templateId: id });
      expect((await send("get", `/assets/${historical.id}`).expect(200)).body.templateId._id).toBe(String(id));
      expect(await snapshot(d)).toBe(before);
    });
  }
}
for (const value of [[null], ["Archived"], {}, 1, false]) test(`malformed status ${JSON.stringify(value)} stays protected after hydration`, async () => {
  const id = oid(); await T.collection.insertOne({ _id: id, ...payload(), status: value });
  const d = await T.findById(id), before = await snapshot(d);
  expect(lifecycle.isArchived(d)).toBe(true);
  expect(await T.countDocuments({ _id: id, ...lifecycle.activeFilter() })).toBe(0);
  await send("post", "/assets", { ctrlNumber: "MALFORMED", templateId: String(id) }).expect(409);
  await archive(d); expect(await snapshot(d)).toBe(before);
});
for (const marker of [{}, { deletedAt: null, deletedBy: null, archivedAt: null, archivedBy: null, isArchived: null, status: null }]) test(`canonical unarchived missing/exact-null metadata ${JSON.stringify(marker)}`, async () => {
  const id = oid(); await T.collection.insertOne({ _id: id, ...payload(), ...marker });
  const d = await T.findById(id);
  expect(lifecycle.isArchived(d)).toBe(false);
  expect(await T.countDocuments({ _id: id, ...lifecycle.activeFilter() })).toBe(1);
  await send("put", `/templates/${id}`, { description: "Valid update" }).expect(200);
  await send("post", "/assets", { ctrlNumber: "ACTIVE", templateId: String(id) }).expect(201);
  await archive(d);
});
test("cyclic-parent rejection happens before Template reservation and never persists the Asset", async () => {
  const d = await seed(), b = await asset(), a = await asset({ parentAsset: b._id });
  const before = JSON.stringify(await A.collection.findOne({ _id: b._id }));
  const reserve = jest.spyOn(lifecycle, "withReference");
  await send("put", `/assets/${b.id}`, { templateId: d.id, parentAsset: a.id }).expect(400);
  expect(reserve).not.toHaveBeenCalled();
  expect(JSON.stringify(await A.collection.findOne({ _id: b._id }))).toBe(before);
  expect(await stored(d)).not.toHaveProperty("templateReferenceReservation"); await archive(d);
});
test("deterministic pre-save rejection after reservation releases its exact token", async () => {
  const d = await seed(), b = await asset(), a = await asset();
  const before = JSON.stringify(await A.collection.findOne({ _id: b._id }));
  const reserve = lifecycle.withReference;
  jest.spyOn(lifecycle, "withReference").mockImplementationOnce((...args) => reserve(...args.slice(0, 3), async () => {
    await A.collection.updateOne({ _id: a._id }, { $set: { parentAsset: b._id } });
    return args[3]();
  }));
  await send("put", `/assets/${b.id}`, { templateId: d.id, parentAsset: a.id }).expect(400);
  expect(JSON.stringify(await A.collection.findOne({ _id: b._id }))).toBe(before);
  expect(await stored(d)).not.toHaveProperty("templateReferenceReservation"); await archive(d);
});
test("definitive no-write release cannot clear a different reservation token", async () => {
  const d = await seed(), b = await asset(), a = await asset({ parentAsset: b._id });
  b.parentAsset = a._id;
  await expect(lifecycle.withReference(d._id, "synthetic", b._id, async () => {
    await T.collection.updateOne({ _id: d._id }, { $set: { "templateReferenceReservation.token": "other-operation" } });
    return b.validateParentRelationship();
  })).rejects.toMatchObject({ status: 409 });
  expect((await stored(d)).templateReferenceReservation.token).toBe("other-operation");
  expect((await A.findById(b._id)).parentAsset).toBeFalsy();
  await send("patch", `/templates/${d.id}/archive`, {}, "admin").expect(409);
});

// #11 operational and benchmark populations share one explicit Facility cohort.
test('operational cohort includes only Active + Inactive; Pending separate and other cohorts excluded',async()=>{
 const t=await seed();
 const active=await asset({templateId:t.id,status:'Active'}),inactive=await asset({templateId:t.id,status:'Inactive'});
 await asset({templateId:t.id,status:'Pending'});await asset({templateId:t.id,status:'Retired'});await asset({templateId:t.id,status:'Active',isArchived:true});
 const deleted=await asset({templateId:t.id,status:'Active'});await A.collection.updateOne({_id:deleted._id},{$set:{deletedAt:new Date()}});
 await asset({templateId:t.id,status:'Active',facilityId:String(oid())});
 const before=JSON.stringify(await A.collection.find({}).toArray());
 const r=(await send('get',`/templates/${t.id}/lifecycle`).expect(200)).body;
 expect(r.population).toMatchObject({populationAssetCount:2,pendingAssetCount:1,assessedAssetCount:2,facilityId:facility});
 expect(r.members.map(row=>row.assetId).sort()).toEqual([active.id,inactive.id].sort());
 expect(r.benchmarks.local.population).toEqual(r.population);expect(r.benchmarks.global).toBeNull();
 expect(r.age.stateCounts.unknown).toBe(2);expect(r.age.buckets.map(b=>b.count)).toEqual([0,0,0,0]);
 expect(r.replacementReview).toMatchObject({insufficientDataCount:2,notRecommendedCount:0});
 expect(r.capital.replacementValue).toMatchObject({total:null,knownSubtotal:0,missingAssetCount:2});
 expect(JSON.stringify(await A.collection.find({}).toArray())).toBe(before);
});
test('empty Template fleet percentages are null',async()=>{const t=await seed();const r=(await send('get',`/templates/${t.id}/lifecycle`).expect(200)).body;expect(r.replacementReview.recommendedPercentOfPopulation).toBeNull();expect(r.summary.replacementRecommendedPercent).toBeNull();expect(r.maintenance.directMaintenance.statistics.fleetMean).toBeNull();});
test('failed live Template assessment remains in operational population and sample denominator',async()=>{const t=await seed();await asset({templateId:t.id,status:'Active'});const service=requireCore('./src/services/lifecycleMaintenance.js').default;jest.spyOn(service,'getMaintenanceTotalsBatch').mockRejectedValueOnce(new Error('synthetic dependency failure'));const r=(await send('get',`/templates/${t.id}/lifecycle`).expect(200)).body;expect(r.population).toMatchObject({populationAssetCount:1,assessedAssetCount:0,unavailableAssessmentCount:1});expect(r.maintenance.directMaintenance).toMatchObject({total:null,isComplete:false,statistics:{sampleAssetCount:0,populationAssetCount:1,fleetMean:null}});expect(r.replacementReview.unavailableAssessmentCount).toBe(1);});
