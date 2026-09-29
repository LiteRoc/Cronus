import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const secret = randomBytes(32).toString('hex');
let harness, app, Task, Procedure, WorkOrder, TaskResult, mutations, measurements;
let task, procedure, workOrder, facility, actor;
const oid = () => new mongoose.Types.ObjectId();
const headers = (role = 'technician', scope = facility) => ({
  'x-facility-id': String(scope),
  Authorization: `Bearer ${jwt.sign({ sub: String(actor), role, facilityId: String(scope), facilities: [String(scope)] }, secret,
    { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`,
});
const path = () => `/workorders/${workOrder}/procedure/${procedure._id}/task-results`;
const read = () => WorkOrder.collection.findOne({ _id: workOrder });
const row = async () => (await read()).procedures[0].taskResults[0];
const attach = () => request(app).patch(`/workorders/${workOrder}/procedure`).set(headers()).send({ procedureId: String(procedure._id) });
const submit = (value, fields = {}) => request(app).patch(path()).set(headers()).send({ taskResults: [{ taskId: String(task._id), type: 'measurement', value, ...fields }] });
const complete = method => method === 'put'
  ? request(app).put(`/workorders/${workOrder}`).set(headers()).send({ status: 'Completed' })
  : request(app).patch(`/workorders/${workOrder}/status`).set(headers()).send({ status: 'Completed' });

jest.setTimeout(60000);
beforeAll(async () => {
  process.env.JWT_SECRET = secret; process.env.JWT_ISS = 'cronus.api'; process.env.JWT_AUD = 'cronus.app';
  process.env.CRON_ENABLED = 'false';
  harness = await createIsolatedMongoHarness(mongoose);
  Task = require('../../models/Task'); Procedure = require('../../models/Procedure');
  WorkOrder = require('../../models/WorkOrder'); TaskResult = require('../../models/TaskResults');
  mutations = require('../../services/procedureResults'); measurements = require('../../services/procedureMeasurements');
  app = express(); app.use(express.json());
  app.use('/tasks', require('../taskRouter')); app.use('/workorders', require('../workOrderRouter'));
});
beforeEach(async () => {
  facility = oid(); actor = oid(); workOrder = oid();
  task = await Task.create({ description: 'Synthetic reading', type: 'measurement', unit: 'V', minValue: 0, maxValue: 10 });
  procedure = await Procedure.create({ name: 'Synthetic procedure', tasks: [task._id] });
  await WorkOrder.collection.insertOne({ _id: workOrder, facilityId: facility, assetId: oid(), description: 'Synthetic only', status: 'Open', procedures: [] });
});
afterEach(async () => { jest.restoreAllMocks(); for (const Model of [WorkOrder, Task, Procedure, TaskResult]) await Model.deleteMany({}); });
afterAll(async () => { if (harness) await harness.stop(); });

test('test persistence refuses configured or unissued MongoDB URIs', async () => {
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued');
});

test.each([
  ['standard', 'V', undefined, 'V'], ['dimensionless', 'dimensionless', undefined, null],
  ['custom', 'custom', 'mystery-count / cycle', 'mystery-count / cycle'],
  ['custom exact label', 'custom', '  custom units  ', '  custom units  '],
])('%s unit and bounds survive attachment and hostile/omitted submission metadata', async (_, unit, customUnitLabel, display) => {
  task.unit = unit; task.customUnitLabel = customUnitLabel; await task.save();
  await attach().expect(200);
  const captured = (await row()).measurementSnapshot;
  expect(captured).toEqual({ version: 1, type: 'measurement', unit, customUnitLabel: customUnitLabel ?? null, minValue: 0, maxValue: 10, required: true });
  await submit(5, { unitOfMeasure: 'kg', measurementSnapshot: { unit: 'kg' }, result: 999, passed: false, completed: false, minValue: 999 }).expect(200);
  expect((await row()).measurementSnapshot).toEqual(captured);
  expect(await row()).toMatchObject({ value: 5, unitOfMeasure: display, passed: true, completed: true });
  await submit(6).expect(200);
  expect((await row()).measurementSnapshot).toEqual(captured);
  expect((await row()).unitOfMeasure).toBe(display);
});

test('source edits/deletion and reattachment cannot reinterpret an existing snapshot', async () => {
  await attach().expect(200); const captured = (await row()).measurementSnapshot;
  task.unit = 'mV'; task.minValue = 100; task.maxValue = 200; task.type = 'comment'; await task.save();
  await attach().expect(200); await submit(5).expect(200);
  expect((await read()).procedures).toHaveLength(1);
  expect(await row()).toMatchObject({ measurementSnapshot: captured, value: 5, passed: true });
  await Task.deleteOne({ _id: task._id }); await Procedure.deleteOne({ _id: procedure._id });
  await submit(11).expect(200); expect((await row()).passed).toBe(false);
});

test('new attachment cannot silently omit a missing Task definition', async () => {
  await Task.deleteOne({ _id: task._id }); await attach().expect(404);
  expect((await read()).procedures).toEqual([]);
});

test.each([
  [0, 10, 0, true], [0, 10, 10, true], [0, 10, 5, true], [0, 10, -1, false], [0, 10, 11, false],
  [0, null, 0, true], [0, null, -1, false], [0, null, 999, true],
  [null, 10, 10, true], [null, 10, 11, false], [null, 10, -999, true],
  [null, null, -999, null], [null, null, 0, null], [5, 5, 5, true], [5, 5, 4.999, false],
])('inclusive bounds [%p,%p], value %p evaluate %p without rejecting reading', async (min, max, value, passed) => {
  task.minValue = min; task.maxValue = max; await task.save(); await attach().expect(200);
  const response = await submit(value).expect(200);
  expect(await row()).toMatchObject({ value, passed, completed: true });
  expect(response.body.taskResults[0]).toMatchObject({ result: value, passed, completed: true, source: 'workOrder' });
  await complete('patch').expect(200);
});

test.each(['5', '5 V', 'nonsense', '', ' ', true, {}, [], null])('reject invalid/absent required reading %p atomically', async value => {
  await attach().expect(200); const before = await read();
  await submit(value).expect(400); expect(await read()).toEqual(before);
  expect(await TaskResult.countDocuments({})).toBe(0);
});
test.each([NaN, Infinity, -Infinity])('non-finite reading %p is rejected before persistence', value => {
  expect(() => measurements.evaluate(value, { version: 1, minValue: null, maxValue: null })).toThrow('finite');
});

test.each(['patch', 'put'])('%s completion rejects required blank and allows recorded failure', async method => {
  await attach().expect(200); await complete(method).expect(400);
  expect((await read()).status).toBe('Open');
  await submit(11).expect(200); await complete(method).expect(200);
  expect((await read()).status).toBe('Completed'); expect((await row()).passed).toBe(false);
  await submit(null).expect(400); expect((await row()).value).toBe(11);
});
test('optional blank measurement stays incomplete and unevaluated but does not block work completion', async () => {
  task.requiredMeasurement = false; await task.save(); await attach().expect(200);
  await submit(null).expect(200); expect(await row()).toMatchObject({ value: null, passed: null, completed: false });
  await complete('patch').expect(200);
});
test('cannot attach a required blank measurement to completed work', async () => {
  await complete('patch').expect(200); await attach().expect(400); expect((await read()).procedures).toHaveLength(0);
});

test('canonical projected result always matches embedded value; historical conflict stays untouched', async () => {
  await attach().expect(200);
  // An actual legacy-shaped row: conflicting representations remain separately
  // readable until this specific result is explicitly resubmitted.
  await WorkOrder.collection.updateOne({ _id: workOrder }, { $set: {
    'procedures.0.taskResults.0': { taskId: task._id, type: 'measurement', value: 5, unitOfMeasure: 'V' },
  } });
  const historical = await TaskResult.create({ taskId: task._id, workOrderId: workOrder, procedureId: procedure._id, type: 'measurement', result: 99, unitOfMeasure: 'kg' });
  const history = await TaskResult.collection.findOne({ _id: historical._id });
  const oldRead = await request(app).get(path()).set(headers()).expect(200);
  expect(oldRead.body.legacyTaskResults[0].result).toBe(99);
  for (const value of [0, 5, 15]) {
    const write = await submit(value, { result: 12345 }).expect(200);
    const view = await request(app).get(path()).set(headers()).expect(200);
    expect(write.body.taskResults[0].result).toBe(value); expect(view.body.taskResults[0].result).toBe((await row()).value);
    expect(view.body.legacyTaskResults).toEqual([]);
    expect(await TaskResult.collection.findOne({ _id: historical._id })).toEqual(history);
  }
});
test('legacy missing snapshots remain unknown on read and explicit numeric resubmission', async () => {
  await WorkOrder.collection.updateOne({ _id: workOrder }, { $set: { procedures: [{ _id: procedure._id, name: procedure.name,
    taskResults: [{ taskId: task._id, type: 'measurement', label: 'Legacy 10 volts', value: '5 V' }] }] } });
  const before = await read(); await request(app).get(path()).set(headers()).expect(200); expect(await read()).toEqual(before);
  await submit(999, { unitOfMeasure: 'V', measurementSnapshot: { version: 1, minValue: 0, maxValue: 10 } }).expect(200);
  const saved = await row(); expect(saved.measurementSnapshot).toBeUndefined(); expect(saved.unitOfMeasure).toBeUndefined();
  expect(saved.value).toBe(999); expect(saved.passed).toBeNull(); expect(saved.completed).toBe(true);
});
test('partial submission preserves other attached snapshots and readings', async () => {
  const second = await Task.create({ description: 'Second', type: 'measurement', unit: 'A' });
  procedure.tasks.push(second._id); await procedure.save(); await attach().expect(200);
  const before = (await read()).procedures[0].taskResults[1];
  await submit(3).expect(200); expect((await read()).procedures[0].taskResults[1]).toEqual(before);
  await complete('patch').expect(400);
});
test('same reusable task in two procedures has distinct canonical results', async () => {
  await attach().expect(200); const second = await Procedure.create({ name: 'Other', tasks: [task._id] });
  await request(app).patch(`/workorders/${workOrder}/procedure`).set(headers()).send({ procedureId: String(second._id) }).expect(200);
  await submit(1).expect(200);
  await request(app).patch(`/workorders/${workOrder}/procedure/${second._id}/task-results`).set(headers()).send({ taskResults: [{ taskId: String(task._id), value: 8 }] }).expect(200);
  const saved = await read(); expect(TaskResult.fromWorkOrder(saved, procedure._id)[0].result).toBe(1);
  expect(TaskResult.fromWorkOrder(saved, second._id)[0].result).toBe(8);
});
test('invalid mixed batch is rejected without partial mutation', async () => {
  await attach().expect(200); const before = await read();
  await request(app).patch(path()).set(headers()).send({ taskResults: [{ taskId: String(task._id), value: 5 }, { taskId: String(oid()), value: 4 }] }).expect(404);
  expect(await read()).toEqual(before);
});
test('duplicate tasks and attempts to change captured task type are rejected', async () => {
  await attach().expect(200); const before = await read();
  await request(app).patch(path()).set(headers()).send({ taskResults: [{ taskId: String(task._id), value: 1 }, { taskId: String(task._id), value: 2 }] }).expect(400);
  await submit(5, { type: 'comment' }).expect(400); expect(await read()).toEqual(before);
});
test('concurrent result writes use a single atomic commit and a deterministic conflict', async () => {
  await attach().expect(200); let reached = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const race = value => mutations.mutate({ _id: workOrder, facilityId: facility }, String(actor), async source => {
    reached++; if (reached === 2) release(); await barrier;
    return mutations.submit(source, procedure._id, [{ taskId: String(task._id), value }], actor);
  });
  const results = await Promise.allSettled([race(1), race(2)]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(r => r.status === 'rejected').reason.status).toBe(409);
  const view = await request(app).get(path()).set(headers()).expect(200);
  expect(view.body.taskResults[0].result).toBe((await row()).value);
});
test('persistence failure cannot leave a second independently written representation', async () => {
  await attach().expect(200); const before = await read();
  jest.spyOn(WorkOrder, 'findOneAndUpdate').mockRejectedValueOnce(new Error('synthetic failure'));
  await submit(5).expect(500); expect(await read()).toEqual(before); expect(await TaskResult.countDocuments({})).toBe(0);
});

test.each(['get', 'patch'])('%s current result endpoint preserves Facility and role boundaries', async method => {
  await attach().expect(200); const before = await read();
  const body = { taskResults: [{ taskId: String(task._id), value: 5 }] };
  await request(app)[method](path()).send(body).expect(401);
  await request(app)[method](path()).set(headers('viewer')).send(body).expect(403);
  await request(app)[method](path()).set(headers('technician', oid())).send(body).expect(404);
  expect(await read()).toEqual(before);
});

test.each([
  { unit: undefined }, { unit: '' }, { unit: 'volts' }, { unit: 'custom' },
  { unit: 'custom', customUnitLabel: '   ' }, { unit: 'V', customUnitLabel: 'volts' },
  { unit: 'V', minValue: 20, maxValue: 10 }, { unit: 'V', minValue: '0' },
  { unit: 'V', requiredMeasurement: 'false' },
])('definition API rejects ambiguous or invalid measurement metadata %p', async fields => {
  await request(app).post('/tasks').set(headers('admin')).send({ description: 'New', type: 'measurement', ...fields }).expect(400);
});
test('vocabulary API includes explicit custom and dimensionless, with no conversion', async () => {
  const { body } = await request(app).get('/tasks/measurement-units').set(headers()).expect(200);
  expect(body.units).toEqual(expect.arrayContaining(['dimensionless', 'custom', 'V', 'mV', '°C', '°F']));
});

test('edits target only selected results and leave neighboring legacy records byte-for-byte equivalent', async () => {
  await attach().expect(200);
  const legacy = { _id: oid(), name: 'Legacy', taskResults: [{ taskId: oid(), type: 'measurement', value: '5 mystery',
    result: 900, minValue: 9, historicalField: { preserve: true } }] };
  await WorkOrder.collection.updateOne({ _id: workOrder }, { $push: { procedures: legacy } });
  const before = (await read()).procedures[1];
  await submit(3).expect(200); expect((await read()).procedures[1]).toEqual(before);
  await request(app).delete(`/workorders/${workOrder}/procedure/${procedure._id}`).set(headers()).expect(200);
  expect((await read()).procedures[0]).toEqual(before);
  await attach().expect(200); expect((await read()).procedures[0]).toEqual(before);
});
test('ordinary edit does not retroactively invalidate completed legacy work', async () => {
  await WorkOrder.collection.updateOne({ _id: workOrder }, { $set: { status: 'Completed', procedures: [{ _id: procedure._id,
    taskResults: [{ taskId: task._id, type: 'measurement', value: '5 unknown' }] }] } });
  const old = (await read()).procedures;
  await request(app).put(`/workorders/${workOrder}`).set(headers()).send({ description: 'Edited description' }).expect(200);
  expect((await read()).procedures).toEqual(old);
});
test('completion racing a new required attachment cannot leave incomplete work completed', async () => {
  let reached = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const race = change => mutations.mutate({ _id: workOrder, facilityId: facility }, actor, async source => {
    reached++; if (reached === 2) release(); await barrier; return change(source);
  });
  const entry = { _id: procedure._id, name: procedure.name, taskResults: [measurements.attachment(task)] };
  const results = await Promise.allSettled([
    race(() => ({ status: 'Completed' })),
    race(source => ({ procedures: [...source.procedures, entry], procedureUpdate: { $push: { procedures: entry } } })),
  ]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(r => r.status === 'rejected').reason.status).toBe(409);
  const saved = await read();
  if (saved.status === 'Completed') expect(saved.procedures).toHaveLength(0);
  else expect(saved.procedures).toHaveLength(1);
});
test('submission rechecks parent Facility at the atomic write', async () => {
  await attach().expect(200);
  const original = WorkOrder.collection.findOneAndUpdate.bind(WorkOrder.collection);
  jest.spyOn(WorkOrder.collection, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
    await WorkOrder.collection.updateOne({ _id: workOrder }, { $set: { facilityId: oid() } });
    return original(...args);
  });
  await submit(5).expect(409); expect((await row()).value).toBeNull();
});
test('pass/fail and comment tasks retain their captured types and submit independently of measurement pass', async () => {
  const pass = await Task.create({ description: 'Inspection', type: 'pass/fail' });
  const comment = await Task.create({ description: 'Notes', type: 'comment' });
  procedure.tasks.push(pass._id, comment._id); await procedure.save(); await attach().expect(200);
  await request(app).patch(path()).set(headers()).send({ taskResults: [
    { taskId: String(task._id), value: 20 }, { taskId: String(pass._id), value: false }, { taskId: String(comment._id), value: 'Synthetic note' },
  ] }).expect(200);
  const rows = (await read()).procedures[0].taskResults;
  expect(rows[1]).toMatchObject({ type: 'pass/fail', value: false, passed: false, completed: true });
  expect(rows[2]).toMatchObject({ type: 'comment', value: 'Synthetic note', passed: null, completed: true });
  await complete('patch').expect(200);
});


test.each([
  { _id: 'Completed' }, ['Completed'], { _id: { _id: 'Completed' } },
  1, true, false, null, '', 'invalid', ' Completed ', { _id: 'Archived' },
])('status boundary rejects malformed status %p without any write', async status => {
  await attach().expect(200); const before = await read();
  for (const method of ['put', 'patch']) {
    const url = `/workorders/${workOrder}${method === 'patch' ? '/status' : ''}`;
    await request(app)[method](url).set(headers()).send({ status }).expect(400);
    expect(await read()).toEqual(before);
  }
  await expect(mutations.mutate({ _id: workOrder, facilityId: facility }, actor, () => ({ status })))
    .rejects.toMatchObject({ status: 400 });
  expect(await read()).toEqual(before);
});
test.each(['Open', 'In Progress', 'Requested'])('status boundary preserves valid non-completion status %s', async status => {
  await attach().expect(200);
  await request(app).put(`/workorders/${workOrder}`).set(headers()).send({ status }).expect(200);
  expect((await read()).status).toBe(status); expect((await row()).value).toBeNull();
});
test('status boundary validates Completed against required reading and permits numeric zero', async () => {
  await attach().expect(200); await complete('put').expect(400);
  await submit(0).expect(200); await complete('put').expect(200);
  expect((await read()).status).toBe('Completed'); expect((await row()).value).toBe(0);
});
