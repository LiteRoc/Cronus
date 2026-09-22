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
  if (!process.env.GITEA7_EVIDENCE_DIR) return;
  mkdirSync(process.env.GITEA7_EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(process.env.GITEA7_EVIDENCE_DIR, `${name}.json`),
    JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
async function zeroWorkOrder(id) {
  freezeDate(initialTime);
  await WorkOrder.create({ _id: id, facilityId, assetId, workOrderNumber: parseInt(id.toString().slice(-2), 16),
    description: 'Gitea 7 synthetic zero-cost Work Order', requestDate: initialTime, createdBy: actorId });
  const before = await stored(id);
  expect(before.timeLogs).toEqual([]);
  expect(before.partsUsed).toEqual([]);
  expect(before.costs).toEqual({ labor: 0, parts: 0, total: 0, calculatedAt: initialTime });
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
  await mongoose.model('Asset').collection.insertOne({ _id: assetId, facilityId, ctrlNumber: 'SYNTHETIC-7' });
});
afterEach(() => jest.useRealTimers());
afterAll(async () => { jest.useRealTimers(); if (harness) await harness.stop(); });

test('CONTROL: configured and non-issued MongoDB targets fail closed', async () => {
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued by MongoMemoryServer');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued by MongoMemoryServer');
  expect(mongoose.connection.readyState).toBe(1);
});

test('OBSERVATION A: labor addition stores zero rate/cost and retains prior calculation timestamp', async () => {
  const id = oid(10), before = await zeroWorkOrder(id);
  const payload = { timeSpent: 60, description: 'Synthetic one-hour labor' };
  const response = await request(app).post(`/workorders/${id}/time-logs`).set(headers()).send(payload);
  const after = await stored(id);
  preserve('A-labor-addition', { request: { method: 'POST', path: `/workorders/${id}/time-logs`, payload },
    status: response.status, before, after });
  expect(response.status).toBe(200);
  expect(after.timeLogs).toHaveLength(1);
  expect(after.timeLogs[0]).toMatchObject({ userId: actorId, timeSpent: 60,
    description: payload.description, laborRate: 0, laborCost: 0, createdAt: mutationTime });
  expect(after.costs).toEqual(before.costs);
  expect(after.updatedAt).toEqual(mutationTime);
});

test('OBSERVATION B: two units of a $40 Part store $0 unit/extended/aggregate cost', async () => {
  const id = oid(11), before = await zeroWorkOrder(id);
  await Part.create({ _id: partId, partNumber: 'SYNTHETIC-7-40', description: 'Synthetic $40 Part',
    price: 40, quantityOnHand: 10 });
  const partBefore = await Part.collection.findOne({ _id: partId });
  const payload = { partId: String(partId), quantity: 2 };
  const response = await request(app).post(`/workorders/${id}/parts`).set(headers()).send(payload);
  const after = await stored(id);
  const partAfter = await Part.collection.findOne({ _id: partId });
  preserve('B-part-addition', { request: { method: 'POST', path: `/workorders/${id}/parts`, payload },
    status: response.status, partBefore, partAfter, before, after,
    referenceEconomicValue: partBefore.price * payload.quantity });
  expect(response.status).toBe(201);
  expect(partBefore.price).toBe(40);
  expect(partAfter).toEqual(partBefore);
  expect(after.partsUsed).toHaveLength(1);
  expect(after.partsUsed[0]).toMatchObject({ partId, quantity: 2, unitCost: 0,
    extendedCost: 0, usedBy: actorId, usedAt: mutationTime });
  expect(after.costs).toEqual({ labor: 0, parts: 0, total: 0, calculatedAt: mutationTime });
});
