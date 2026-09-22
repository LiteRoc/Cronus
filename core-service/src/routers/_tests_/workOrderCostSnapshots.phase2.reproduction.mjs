import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

// Frozen observations at 40fd8de41169cb3b6daa231cd4dff031b3e8e34e.
// No app.js, dotenv, jobs, real database, production mocks or cost-policy changes.
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const secret = randomBytes(32).toString('hex');
const oid = n => new mongoose.Types.ObjectId(n.toString(16).padStart(24, '0'));
const facilityId = oid(1), actorId = oid(2), assetId = oid(3), partId = oid(4);
const initialTime = new Date('2026-01-01T00:00:00.000Z');
const mutationTime = new Date('2026-01-02T00:00:00.000Z');
let app, harness, WorkOrder, Part;
jest.setTimeout(120000);

function freezeDate(date) {
  // Only Date is fake: HTTP, MongoDB and timeout scheduling stay real.
  jest.useFakeTimers({ now: date, doNotFake: [
    'hrtime', 'nextTick', 'performance', 'queueMicrotask',
    'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
    'setTimeout', 'clearTimeout',
  ] });
}
function headers() {
  return {
    Authorization: `Bearer ${jwt.sign({ sub: String(actorId), role: 'technician',
      facilityId: String(facilityId), facilities: [String(facilityId)],
    }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`,
    'x-facility-id': String(facilityId),
  };
}
const stored = id => WorkOrder.collection.findOne({ _id: id });
function preserve(name, value) {
  // Explicit destination avoids rewriting frozen evidence on ordinary reruns.
  if (!process.env.GITEA7_PHASE2_EVIDENCE_DIR) return;
  mkdirSync(process.env.GITEA7_PHASE2_EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(process.env.GITEA7_PHASE2_EVIDENCE_DIR, `${name}.json`),
    JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
async function seed(id, fields = {}) {
  freezeDate(initialTime);
  await WorkOrder.create({ _id: id, facilityId, assetId, workOrderNumber: parseInt(id.toString().slice(-2), 16),
    description: 'Gitea 7 synthetic zero-cost Work Order', requestDate: initialTime, createdBy: actorId, ...fields });
  const before = await stored(id);
  jest.setSystemTime(mutationTime);
  return before;
}

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  process.env.JWT_ISS = 'cronus.api'; process.env.JWT_AUD = 'cronus.app';
  harness = await createIsolatedMongoHarness(mongoose);
  WorkOrder = requireCore('./src/models/WorkOrder.js');
  Part = requireCore('./src/models/Part.js');
  // Same real router and mount path as app.js; no application startup.
  app = express(); app.use(express.json());
  app.use('/workorders', requireCore('./src/routers/workOrderRouter.js'));
  await mongoose.model('Facility').collection.insertOne({ _id: facilityId, name: 'Synthetic facility' });
  await mongoose.model('User').collection.insertOne({ _id: actorId, name: 'Synthetic technician',
    role: 'technician', facilities: [facilityId] });
  await mongoose.model('Asset').collection.insertOne({ _id: oid(5), facilityId, ctrlNumber: 'SYNTHETIC-EQUIPMENT' });
  await mongoose.model('Asset').collection.insertOne({ _id: assetId, facilityId, ctrlNumber: 'SYNTHETIC-7' });
});
afterEach(async () => { jest.useRealTimers(); if (harness) { await WorkOrder.deleteMany({}); await Part.deleteMany({}); } });
afterAll(async () => { jest.useRealTimers(); if (harness) await harness.stop(); });

test('CONTROL: configured and non-issued MongoDB targets fail closed', async () => {
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued by MongoMemoryServer');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued by MongoMemoryServer');
  expect(mongoose.connection.readyState).toBe(1);
});


const laterTime = new Date('2026-01-03T00:00:00.000Z');
const labor = () => ({ _id: oid(20), userId: actorId, timeSpent: 60, laborRate: 75,
  laborCost: 75, description: 'Historical labor', createdAt: initialTime });
const usage = () => ({ partId, quantity: 2, unitCost: 40, extendedCost: 80, usedBy: actorId, usedAt: initialTime });
const costs = (labor, parts, calculatedAt) => ({ labor, parts, total: labor + parts, calculatedAt });
async function catalog() {
  await Part.create({ _id: partId, partNumber: 'SYNTHETIC-P2', description: 'Synthetic Part', price: 40, quantityOnHand: 10 });
}
async function mutate(id, method, suffix, payload) {
  const path = '/workorders/' + id + '/' + suffix;
  let call = request(app)[method](path).set(headers());
  if (payload) call = call.send(payload);
  const response = await call;
  return { request: { method: method.toUpperCase(), path, ...(payload ? { payload } : {}) },
    status: response.status, after: await stored(id) };
}
test('OBSERVATION C: deleting priced labor retains $75 and old timestamp', async () => {
  const id = oid(30), before = await seed(id, { timeLogs: [labor()] });
  expect(before.costs).toEqual(costs(75, 0, initialTime));
  const result = await mutate(id, 'delete', 'time-logs/' + oid(20));
  preserve('C-priced-labor-delete', { before, ...result });
  expect(result.status).toBe(200);
  expect(result.after.timeLogs).toEqual([]);
  expect(result.after.costs).toEqual(costs(75, 0, initialTime));
});
test('OBSERVATION D: quantity update preserves $40 and computes $120 parts', async () => {
  await catalog();
  const id = oid(31), before = await seed(id, { timeLogs: [labor()], partsUsed: [usage()] });
  expect(before.costs).toEqual(costs(75, 80, initialTime));
  const result = await mutate(id, 'put', 'parts/' + partId, { quantity: 3 });
  preserve('D-priced-part-quantity', { before, ...result });
  expect(result.status).toBe(200);
  expect(result.after.partsUsed[0]).toMatchObject({ partId, quantity: 3, unitCost: 40, extendedCost: 120 });
  expect(result.after.timeLogs).toEqual(before.timeLogs);
  expect(result.after.costs).toEqual(costs(75, 120, mutationTime));
});
test('OBSERVATION E: part deletion removes $80 and preserves $75 labor', async () => {
  await catalog();
  const id = oid(32), before = await seed(id, { timeLogs: [labor()], partsUsed: [usage()] });
  expect(before.costs).toEqual(costs(75, 80, initialTime));
  const result = await mutate(id, 'delete', 'parts/' + partId);
  preserve('E-priced-part-delete', { before, ...result });
  expect(result.status).toBe(200);
  expect(result.after.partsUsed).toEqual([]);
  expect(result.after.timeLogs).toEqual(before.timeLogs);
  expect(result.after.costs).toEqual(costs(75, 0, mutationTime));
});
test('OBSERVATION F: equipment save advances timestamp but zero-rate labor stays zero', async () => {
  const id = oid(33), before = await seed(id);
  expect(before.costs).toEqual(costs(0, 0, initialTime));
  const addition = await mutate(id, 'post', 'time-logs', { timeSpent: 60, description: 'Synthetic one-hour labor' });
  expect(addition.status).toBe(200);
  expect(addition.after.timeLogs[0]).toMatchObject({ timeSpent: 60, laborRate: 0, laborCost: 0 });
  expect(addition.after.costs).toEqual(costs(0, 0, initialTime));
  jest.setSystemTime(laterTime);
  const save = await mutate(id, 'post', 'test-equipment', { equipmentId: String(oid(5)), note: 'Non-economic mutation' });
  preserve('F-later-unrelated-save', { before, addition, save });
  expect(save.status).toBe(200);
  expect(save.after.testEquipmentUsed).toHaveLength(1);
  for (const key of ['timeLogs', 'partsUsed', 'vendorService', 'travelLogs']) expect(save.after[key]).toEqual(addition.after[key]);
  expect(save.after.costs).toEqual(costs(0, 0, laterTime));
});
test('OBSERVATION G: catalog $60 does not replace historical $40 on save', async () => {
  await catalog();
  const id = oid(34), before = await seed(id, { timeLogs: [labor()], partsUsed: [usage()] });
  const partBefore = await Part.collection.findOne({ _id: partId });
  expect(before.costs).toEqual(costs(75, 80, initialTime));
  // Only the isolated synthetic Part is changed.
  await Part.updateOne({ _id: partId }, { $set: { price: 60 } });
  const partAfter = await Part.collection.findOne({ _id: partId });
  const beforeSave = await stored(id);
  expect(beforeSave).toEqual(before);
  jest.setSystemTime(laterTime);
  const save = await mutate(id, 'post', 'test-equipment', { equipmentId: String(oid(5)), note: 'Historical price observation' });
  preserve('G-catalog-price-change', { before, partBefore, partAfter, beforeSave, save });
  expect(save.status).toBe(200);
  expect(partBefore.price).toBe(40); expect(partAfter.price).toBe(60);
  expect(save.after.partsUsed).toEqual(before.partsUsed);
  expect(save.after.timeLogs).toEqual(before.timeLogs);
  expect(save.after.costs).toEqual(costs(75, 80, laterTime));
});
