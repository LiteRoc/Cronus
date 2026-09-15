import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

// Reproduction only. No app startup, jobs, external clients or real database.
// OBSERVATION assertions describe exercised behavior, not an approved future policy.
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const secret = 'synthetic-workorder-subresource-only';
let app, harness, WorkOrder, Asset, Facility, Part, Procedure, Task, TaskResult, User;
let a, b, wa, wb, aa, ab, pa, pb, procA, procB, taskA, taskB, actorA, actorB;
const fixedDate = new Date('2026-01-01T00:00:00Z');
jest.setTimeout(120000);
const oid = () => new mongoose.Types.ObjectId();
const str = value => String(value);
function headers(role = 'technician', facility = a, overrides = {}) {
  if (role === 'anonymous') return {};
  if (role === 'invalid') return { Authorization: 'Bearer invalid-synthetic-token' };
  return { Authorization: `Bearer ${jwt.sign({
    sub: str(facility.equals(b) ? actorB : actorA), ...(role === 'missing' ? {} : { role }),
    facilityId: str(facility), facilities: [str(facility)], ...overrides,
  }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}`,
  'x-facility-id': str(facility) };
}
const snapshot = async id => JSON.stringify(await WorkOrder.collection.findOne({ _id: id }));
const operations = [
  { name: 'detail', method: 'get', path: w => `/${w._id}`, scoped: true, read: true, gate: false },
  { name: 'time add', method: 'post', path: w => `/${w._id}/time-logs`, scoped: true, payload: () => ({ timeSpent: 10, description: 'Added synthetic labor' }) },
  { name: 'time remove', method: 'delete', path: w => `/${w._id}/time-logs/${w.timeLogs[0]._id}`, scoped: true },
  { name: 'travel add', method: 'post', path: w => `/${w._id}/travel-logs`, scoped: true, payload: () => ({ travelTime: 10, note: 'Added synthetic travel' }) },
  { name: 'travel remove', method: 'delete', path: w => `/${w._id}/travel-logs/${w.travelLogs[0]._id}`, scoped: true },
  { name: 'procedure attach', method: 'patch', path: w => `/${w._id}/procedure`, scoped: true, payload: () => ({ procedureId: str(procB._id) }) },
  { name: 'results submit', method: 'patch', path: w => `/${w._id}/procedure/${w.procedures[0]._id}/task-results`, scoped: true,
    payload: w => ({ taskResults: [{ taskId: str(w.procedures[0].taskResults[0].taskId), type: 'measurement', value: 7, result: 7 }] }) },
  { name: 'procedure remove', method: 'delete', path: w => `/${w._id}/procedure/${w.procedures[0]._id}`, scoped: true },
  { name: 'parts read', method: 'get', path: w => `/${w._id}/parts`, scoped: false, gate: false, read: true },
  { name: 'parts add', method: 'post', path: w => `/${w._id}/parts`, scoped: false, payload: () => ({ partId: str(pa._id), quantity: 2 }), success: 201 },
  { name: 'parts update', method: 'put', path: w => `/${w._id}/parts/${w.partsUsed[0].partId}`, scoped: false, payload: () => ({ quantity: 3, note: 'Synthetic update' }) },
  { name: 'parts remove', method: 'delete', path: w => `/${w._id}/parts/${w.partsUsed[0].partId}`, scoped: false },
  { name: 'equipment add', method: 'post', path: w => `/${w._id}/test-equipment`, scoped: false, gate: false, payload: () => ({ equipmentId: str(ab._id), note: 'Synthetic add' }) },
  { name: 'equipment remove', method: 'delete', path: w => `/${w._id}/test-equipment/${w.testEquipmentUsed[0].equipmentId}`, scoped: false, gate: false },
  { name: 'assign', method: 'patch', path: w => `/${w._id}/assign`, scoped: true, payload: () => ({ assignedTo: str(actorA) }) },
  { name: 'status', method: 'patch', path: w => `/${w._id}/status`, scoped: true, payload: () => ({ status: 'In Progress' }) },
  { name: 'schedule', method: 'patch', path: w => `/${w._id}/schedule`, scoped: true, payload: () => ({ scheduledDate: '2026-10-01' }) },
  { name: 'archive', method: 'patch', path: w => `/${w._id}/archive`, scoped: true, adminOnly: true },
  { name: 'whole update', method: 'put', path: w => `/${w._id}`, scoped: true, payload: () => ({ description: 'Synthetic update' }) },
];
function send(op, w, role = 'technician', facility = a) {
  let call = request(app)[op.method]('/workorders' + op.path(w)).set(headers(role, facility));
  if (op.payload) call = call.send(op.payload(w));
  return call;
}
beforeAll(async () => {
  process.env.JWT_SECRET = secret; process.env.JWT_ISS = 'cronus.api'; process.env.JWT_AUD = 'cronus.app';
  harness = await createIsolatedMongoHarness(mongoose);
  WorkOrder = requireCore('./src/models/WorkOrder.js');
  Asset = requireCore('./src/models/Asset.js');
  Facility = requireCore('./src/models/Facility.js');
  Part = requireCore('./src/models/Part.js');
  Procedure = requireCore('./src/models/Procedure.js');
  Task = requireCore('./src/models/Task.js');
  TaskResult = requireCore('./src/models/TaskResults.js');
  User = requireCore('./src/models/User.js');
  requireCore('./src/models/Supplier.js'); requireCore('./src/models/Manufacturer.js');
  // Mirror app.js import/mount order: assetsRouter sets strictPopulate=false in production.
  app = express(); app.use(express.json());
  app.use('/assets', requireCore('./src/routers/assetsRouter.js'));
  app.use('/workorders', requireCore('./src/routers/workOrderRouter.js'));
  app.use('/parts', requireCore('./src/routers/partRouter.js'));
});
beforeEach(async () => {
  for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
  a = oid(); b = oid(); actorA = oid(); actorB = oid();
  await Facility.collection.insertMany([{ _id: a, name: 'Synthetic A', organizationId: oid() }, { _id: b, name: 'Synthetic B', organizationId: oid() }]);
  await User.collection.insertMany([{ _id: actorA, name: 'Synthetic A actor', email: 'a@example.invalid', username: 'synthetic-a', facilities: [a] }, { _id: actorB, name: 'Synthetic B actor', email: 'b@example.invalid', username: 'synthetic-b', facilities: [b] }]);
  [aa, ab] = [a, b].map((facilityId, i) => ({ _id: oid(), facilityId, ctrlNumber: `Synthetic-${i}`, manufacturer: `Synthetic manufacturer ${i}`, model: `Synthetic model ${i}` }));
  await Asset.collection.insertMany([aa, ab]);
  [pa, pb] = await Part.create(['A', 'B'].map(label => ({ partNumber: `Synthetic part ${label}`, description: `Synthetic ${label} part`, price: 10, quantityOnHand: 5 })));
  [taskA, taskB] = await Task.create(['A', 'B'].map(label => ({ description: `Synthetic task ${label}`, type: 'measurement', unit: 'V' })));
  [procA, procB] = await Procedure.create([{ name: 'Synthetic procedure A', tasks: [taskA._id] }, { name: 'Synthetic procedure B', tasks: [taskB._id] }]);
  const rows = [[a, aa, pa, procA, taskA, actorA], [b, ab, pb, procB, taskB, actorB]].map(([facilityId, asset, part, proc, task, actor], i) => ({
    _id: oid(), facilityId, assetId: asset._id, description: `Private synthetic WO ${i}`, workOrderNumber: i + 1, status: 'Open',
    timeLogs: [{ _id: oid(), userId: actor, timeSpent: 60, description: `Private labor ${i}`, laborRate: 20, laborCost: 20, createdAt: fixedDate }],
    travelLogs: [{ _id: oid(), userId: actor, travelTime: 30, note: `Private travel ${i}`, createdAt: fixedDate }],
    partsUsed: [{ partId: part._id, quantity: 1, unitCost: 10, extendedCost: 10, usedBy: actor, usedAt: fixedDate, note: `Private part ${i}` }],
    testEquipmentUsed: [{ _id: oid(), equipmentId: asset._id, usedBy: actor, usedAt: fixedDate, note: `Private equipment ${i}` }],
    procedures: [{ _id: proc._id, name: proc.name, taskResults: [{ taskId: task._id, type: 'measurement', value: 100 + i, label: task.description, submittedBy: actor, submittedAt: fixedDate }] }],
    costs: { labor: 20, parts: 10, total: 30, calculatedAt: fixedDate }, updatedBy: actor,
  }));
  await WorkOrder.collection.insertMany(rows); [wa, wb] = rows;
});
afterEach(async () => {
  jest.restoreAllMocks();
  if (harness) for (const Model of [WorkOrder, Asset, Facility, Part, Procedure, Task, TaskResult, User]) if (Model) await Model.deleteMany({});
});
afterAll(async () => { if (harness) await harness.stop(); });

test('CONTROL: only issued ephemeral persistence can connect', async () => {
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued by MongoMemoryServer');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued by MongoMemoryServer');
  expect(await WorkOrder.countDocuments()).toBe(2);
});
for (const op of operations) {
  test(`CONTROL: authorized ${op.name} succeeds on own Work Order`, async () => {
    await send(op, wa, op.adminOnly ? 'admin' : 'technician').expect(op.success || 200);
    if (!op.read) expect(await snapshot(wa._id)).not.toBe(JSON.stringify(wa));
  });
  test(`${op.scoped ? 'CONTROL' : 'OBSERVATION'}: A technician -> B parent: ${op.name}`, async () => {
    const before = await snapshot(wb._id);
    const expected = op.adminOnly ? 403 : op.scoped ? 404 : op.success || 200;
    const response = await send(op, wb).expect(expected);
    if (expected >= 400) expect(await snapshot(wb._id)).toBe(before);
    else if (!op.read) expect(await snapshot(wb._id)).not.toBe(before);
    else expect(JSON.stringify(response.body)).toContain(op.name === 'parts read' ? 'Private part 1' : 'Private synthetic WO 1');
  });
  for (const role of ['admin', 'customer', 'viewer', 'tech', 'missing', 'unknown', 'anonymous', 'invalid']) {
    test(`MATRIX: ${role} ${op.name} on Facility A`, async () => {
      const expected = role === 'anonymous' ? 401 : role === 'invalid' ? 403 : role === 'admin' ? op.success || 200
        : op.gate === false ? op.success || 200 : 403;
      const before = await snapshot(wa._id);
      await send(op, wa, role).expect(expected);
      if (expected >= 400) expect(await snapshot(wa._id)).toBe(before);
    });
  }
  test(`CONTROL: Facility B technician ${op.name} on B`, async () => {
    await send(op, wb, 'technician', b).expect(op.adminOnly ? 403 : op.success || 200);
  });
  if (!op.scoped) {
    test(`SECURITY: ${op.name} must enforce parent Facility ownership`, async () => {
      const before = await snapshot(wb._id);
      const response = await send(op, wb);
      expect([403, 404]).toContain(response.status);
      expect(await snapshot(wb._id)).toBe(before);
    });
  }
}
for (const role of ['customer', 'viewer', 'tech', 'missing', 'unknown']) {
  for (const name of ['equipment add', 'equipment remove']) {
    test(`SECURITY: ${role} cannot ${name}`, async () => {
      const before = await snapshot(wa._id);
      const response = await send(operations.find(op => op.name === name), wa, role);
      expect(response.status).toBe(403);
      expect(await snapshot(wa._id)).toBe(before);
    });
  }
}

test('OBSERVATION: foreign equipment attachment returns foreign Asset metadata and full parent data', async () => {
  await request(app).get(`/assets/${ab._id}`).set(headers()).expect(404);
  const { body } = await request(app).post(`/workorders/${wa._id}/test-equipment`).set(headers()).send({ equipmentId: str(ab._id) }).expect(200);
  expect(body.testEquipmentUsed.at(-1).equipmentId).toMatchObject({ _id: str(ab._id), model: ab.model, manufacturer: ab.manufacturer });
});
test('SECURITY: foreign Asset reference must not bypass Asset Facility visibility', async () => {
  const before = await snapshot(wa._id);
  const response = await request(app).post(`/workorders/${wa._id}/test-equipment`).set(headers()).send({ equipmentId: str(ab._id) });
  expect([400, 403, 404]).toContain(response.status);
  expect(await snapshot(wa._id)).toBe(before);
});
test('OBSERVATION: global Parts/Procedures have no schema Facility owner; all can be referenced', async () => {
  expect(Part.schema.path('facilityId')).toBeUndefined();
  expect(Procedure.schema.path('facilityId')).toBeUndefined();
  expect(Task.schema.path('facilityId')).toBeUndefined();
  await request(app).post(`/workorders/${wa._id}/parts`).set(headers()).send({ partId: str(pb._id), quantity: 1 }).expect(201);
  await request(app).patch(`/workorders/${wa._id}/procedure`).set(headers()).send({ procedureId: str(procB._id) }).expect(200);
});
test('OBSERVATION: synthetic legacy Facility-tagged Part hidden by list can be attached/read through WO', async () => {
  await Part.collection.updateOne({ _id: pb._id }, { $set: { facilityId: b } });
  const list = await request(app).get('/parts').set(headers()).expect(200);
  expect(list.body.map(p => p._id)).not.toContain(str(pb._id));
  await request(app).post(`/workorders/${wa._id}/parts`).set(headers()).send({ partId: str(pb._id), quantity: 1 }).expect(201);
  const { body } = await request(app).get(`/workorders/${wa._id}/parts`).set(headers()).expect(200);
  expect(body.some(p => p.partId?._id === str(pb._id))).toBe(true);
});
for (const [path, payload, field] of [
  ['time-logs', { timeSpent: 5 }, 'timeLogs'], ['travel-logs', { travelTime: 5 }, 'travelLogs'],
  ['parts', { quantity: 1 }, 'partsUsed'], ['test-equipment', {}, 'testEquipmentUsed'],
]) {
  test(`CONTROL: ${path} add ignores spoofed actor/time`, async () => {
    await request(app).post(`/workorders/${wa._id}/${path}`).set(headers()).send({ ...payload,
      partId: str(pa._id), equipmentId: str(aa._id), userId: str(actorB), usedBy: str(actorB), updatedBy: str(actorB), usedAt: '2001-01-01', createdAt: '2001-01-01',
    }).expect(path === 'parts' ? 201 : 200);
    const last = (await WorkOrder.findById(wa._id).lean())[field].at(-1);
    expect(str(last.userId || last.usedBy)).toBe(str(actorA));
    expect(new Date(last.createdAt || last.usedAt).getUTCFullYear()).not.toBe(2001);
  });
}
test('OBSERVATION: whole-WO PUT replaces log arrays and accepts spoofed log actor/date', async () => {
  await request(app).put(`/workorders/${wa._id}`).set(headers()).send({ timeLogs: [{ userId: str(actorB), timeSpent: 7, createdAt: '2001-01-01' }] }).expect(200);
  const wo = await WorkOrder.findById(wa._id).lean();
  expect(str(wo.timeLogs[0].userId)).toBe(str(actorB));
  expect(new Date(wo.timeLogs[0].createdAt).getUTCFullYear()).toBe(2001);
});
test('OBSERVATION: task submission overrides actor but accepts a nonmember/nonexistent task ID', async () => {
  const unknownTask = oid();
  await request(app).patch(`/workorders/${wa._id}/procedure/${procA._id}/task-results`).set(headers()).send({ taskResults: [
    { taskId: str(unknownTask), type: 'measurement', value: 9, result: 9, submittedBy: str(actorB), submittedAt: '2001-01-01' },
  ] }).expect(200);
  const result = await TaskResult.findOne({ workOrderId: wa._id, taskId: unknownTask }).lean();
  expect(str(result.submittedBy)).toBe(str(actorA));
  expect(await Task.findById(unknownTask)).toBeNull();
  const nested = (await WorkOrder.findById(wa._id)).procedures[0].taskResults[0];
  expect(str(nested.submittedBy)).toBe(str(actorA));
  expect(nested.submittedAt.getUTCFullYear()).not.toBe(2001);
});
test('OBSERVATION #7: query-based labor removal leaves prior cost snapshot', async () => {
  await send(operations.find(op => op.name === 'time remove'), wa).expect(200);
  const wo = await WorkOrder.findById(wa._id).lean();
  expect(wo.timeLogs).toHaveLength(0);
  expect(wo.costs.labor).toBe(20);
  expect(wo.costs.calculatedAt).toEqual(fixedDate);
});
test('OBSERVATION #9: procedure attachment loses Task.unit mapping', async () => {
  await send(operations.find(op => op.name === 'procedure attach'), wa).expect(200);
  const result = (await WorkOrder.findById(wa._id)).procedures.find(p => p._id.equals(procB._id)).taskResults[0];
  expect(taskB.unit).toBe('V'); expect(result.unitOfMeasure).toBeNull();
});

for (const op of operations) {
  test(`ERROR: ${op.name} malformed parent ID`, async () => {
    const fake = { ...wa, _id: 'bad-id' };
    const role = op.adminOnly ? 'admin' : 'technician';
    await send(op, fake, role).expect(op.scoped ? 400 : 500);
  });
  test(`CONTROL: ${op.name} absent parent ID`, async () => {
    await send(op, { ...wa, _id: oid() }, op.adminOnly ? 'admin' : 'technician').expect(404);
  });
  test(`OBSERVATION: admin selected A -> B ${op.name}`, async () => {
    await send(op, wb, 'admin').expect(op.scoped ? 404 : op.success || 200);
  });
}
for (const suffix of ['time-logs', 'travel-logs', 'test-equipment', 'procedure', 'procedure/results', 'attachments', 'comments', 'notes']) {
  test(`CONTROL: no dedicated GET ${suffix} is mounted`, async () => {
    await request(app).get(`/workorders/${wa._id}/${suffix}`).set(headers()).expect(404);
  });
}
for (const field of ['time-logs', 'travel-logs', 'test-equipment']) {
  test(`CONTROL: no dedicated PATCH ${field} edit is mounted`, async () => {
    await request(app).patch(`/workorders/${wa._id}/${oid()}`).set(headers()).send({ value: 'Synthetic' }).expect(404);
    await request(app).patch(`/workorders/${wa._id}/${field}/${oid()}`).set(headers()).send({ value: 'Synthetic' }).expect(404);
  });
}
for (const name of ['time remove', 'travel remove', 'procedure remove', 'parts remove', 'parts update', 'equipment remove']) {
  for (const child of ['bad-id', 'absent', 'foreign-child']) {
    test(`ERROR: ${name} ${child} under authorized parent`, async () => {
      const op = operations.find(op => op.name === name);
      const foreignId = op.path(wb).split('/').at(-1);
      const id = child === 'absent' ? str(oid()) : child === 'foreign-child' ? foreignId : child;
      const path = '/workorders' + op.path(wa).replace(/[^/]+$/, id);
      let call = request(app)[op.method](path).set(headers());
      if (op.payload) call = call.send(op.payload(wa));
      await call.expect(name === 'equipment remove' ? 200 : name === 'procedure remove' && child === 'bad-id' ? 400 : 404);
    });
  }
}
for (const resource of ['parts', 'test-equipment', 'procedure']) {
  for (const kind of ['malformed', 'absent']) {
    test(`ERROR: ${resource} ${kind} reference`, async () => {
      const id = kind === 'malformed' ? 'bad-id' : str(oid());
      const method = resource === 'procedure' ? 'patch' : 'post';
      const payload = resource === 'parts' ? { partId: id, quantity: 1 } : resource === 'procedure' ? { procedureId: id } : { equipmentId: id };
      const status = resource === 'test-equipment' ? kind === 'malformed' ? 500 : 200 : kind === 'malformed' ? 400 : 404;
      await request(app)[method](`/workorders/${wa._id}/${resource}`).set(headers()).send(payload).expect(status);
      if (resource === 'test-equipment' && kind === 'absent') {
        expect(str((await WorkOrder.findById(wa._id)).testEquipmentUsed.at(-1).equipmentId)).toBe(id);
        expect(await Asset.findById(id)).toBeNull();
      }
    });
  }
}
test('ERROR: malformed procedure result ID exposes stack; absent procedure returns 404', async () => {
  const payload = { taskResults: [{ taskId: str(taskA._id), type: 'measurement', value: 1 }] };
  const malformed = await request(app).patch(`/workorders/${wa._id}/procedure/bad-id/task-results`).set(headers()).send(payload).expect(500);
  expect(typeof malformed.body.stack).toBe('string');
  expect(malformed.body.stack).toContain('workOrderRouter');
  await request(app).patch(`/workorders/${wa._id}/procedure/${oid()}/task-results`).set(headers()).send(payload).expect(404);
});
test('SECURITY: malformed task-result route must not expose internal stack', async () => {
  const { body } = await request(app).patch(`/workorders/${wa._id}/procedure/bad-id/task-results`).set(headers())
    .send({ taskResults: [] });
  expect(body).not.toHaveProperty('stack');
});
test('ERROR: malformed task ID surfaces raw Mongoose details in result submission', async () => {
  const response = await request(app).patch(`/workorders/${wa._id}/procedure/${procA._id}/task-results`).set(headers())
    .send({ taskResults: [{ taskId: 'bad-id', type: 'measurement', value: 1 }] }).expect(500);
  expect(response.body.error).toContain('Cast');
  expect(response.body).toHaveProperty('stack');
});
test('OBSERVATION: unsupported parts queries leave foreign-parent disclosure unchanged', async () => {
  const { body } = await request(app).get(`/workorders/${wb._id}/parts?q=absent&search=absent&facilityId=${a}&page=99&limit=1`)
    .set(headers()).expect(200);
  expect(body).toHaveLength(1);
  expect(body[0].note).toBe('Private part 1');
  const own = await request(app).get(`/workorders/${wa._id}?q=absent&facilityId=${b}`).set(headers()).expect(200);
  expect(own.body._id).toBe(str(wa._id));
  await request(app).get(`/workorders/${wb._id}?q=anything&facilityId=${a}`).set(headers()).expect(404);
});
test('OBSERVATION: test-equipment add to foreign WO exposes other nested private data', async () => {
  const { body } = await send(operations.find(op => op.name === 'equipment add'), wb).expect(200);
  expect(body.description).toBe(wb.description);
  expect(body.timeLogs[0].description).toBe('Private labor 1');
  expect(body.travelLogs[0].note).toBe('Private travel 1');
  expect(body.procedures[0].taskResults[0].value).toBe(101);
});
test('CONTROL: direct foreign reads of nested results/labor/travel through WO detail are denied', async () => {
  await request(app).get(`/workorders/${wb._id}`).set(headers()).expect(404);
  const { body } = await request(app).get(`/workorders/${wa._id}`).set(headers()).expect(200);
  expect(body.timeLogs[0].description).toBe('Private labor 0');
  expect(body.travelLogs[0].note).toBe('Private travel 0');
  expect(body.procedures[0].taskResults[0].value).toBe(100);
});
test('SECURITY: technician whole update must not impersonate another labor actor', async () => {
  await request(app).put(`/workorders/${wa._id}`).set(headers()).send({ timeLogs: [{ userId: str(actorB), timeSpent: 7, createdAt: '2001-01-01' }] });
  const logs = (await WorkOrder.findById(wa._id)).timeLogs;
  expect(logs.every(log => str(log.userId) === str(actorA))).toBe(true);
});
test('OBSERVATION: result task need not belong to attached Procedure', async () => {
  await request(app).patch(`/workorders/${wa._id}/procedure/${procA._id}/task-results`).set(headers())
    .send({ taskResults: [{ taskId: str(taskB._id), type: 'measurement', value: 42, result: 42 }] }).expect(200);
  expect((await Procedure.findById(procA._id)).tasks.map(str)).not.toContain(str(taskB._id));
  expect(await TaskResult.countDocuments({ workOrderId: wa._id, taskId: taskB._id })).toBe(1);
});
test('CONTROL: nested Asset workorders mount is scoped list, not delegation to mutation routes', async () => {
  const before = await snapshot(wb._id);
  await request(app).post(`/assets/${ab._id}/workorders/${wb._id}/test-equipment`).set(headers()).send({ equipmentId: str(aa._id) }).expect(404);
  const { body } = await request(app).post(`/assets/${aa._id}/workorders/${wb._id}/test-equipment`).set(headers()).send({ equipmentId: str(aa._id) }).expect(200);
  expect(body.workOrders.map(w => w._id)).toEqual([str(wa._id)]);
  expect(await snapshot(wb._id)).toBe(before);
});

test('OBSERVATION: whole-WO update also accepts travel/equipment/procedure actor snapshots', async () => {
  await request(app).put(`/workorders/${wa._id}`).set(headers()).send({
    travelLogs: [{ userId: str(actorB), travelTime: 12, createdAt: '2001-01-01' }],
    testEquipmentUsed: [{ equipmentId: str(ab._id), usedBy: str(actorB), usedAt: '2001-01-01' }],
    procedures: [{ _id: str(procA._id), name: 'Synthetic', taskResults: [{ taskId: str(taskB._id), type: 'measurement', value: 4, submittedBy: str(actorB), submittedAt: '2001-01-01' }] }],
  }).expect(200);
  const wo = await WorkOrder.findById(wa._id).lean();
  expect(str(wo.travelLogs[0].userId)).toBe(str(actorB));
  expect(str(wo.testEquipmentUsed[0].usedBy)).toBe(str(actorB));
  expect(str(wo.procedures[0].taskResults[0].submittedBy)).toBe(str(actorB));
  const detail = await request(app).get(`/workorders/${wa._id}`).set(headers()).expect(200);
  expect(detail.body.testEquipmentUsed[0].equipmentId.model).toBe(ab.model);
});
test('SECURITY: whole-WO update must not attach an inaccessible equipment Asset', async () => {
  const response = await request(app).put(`/workorders/${wa._id}`).set(headers()).send({
    testEquipmentUsed: [{ equipmentId: str(ab._id), usedBy: str(actorA) }],
  });
  expect([400, 403, 404]).toContain(response.status);
  expect((await WorkOrder.findById(wa._id)).testEquipmentUsed.map(t => str(t.equipmentId))).not.toContain(str(ab._id));
});
test('CONTROL: task result body cannot redirect the standalone result to foreign WO/procedure', async () => {
  await request(app).patch(`/workorders/${wa._id}/procedure/${procA._id}/task-results`).set(headers()).send({ taskResults: [{
    taskId: str(taskA._id), type: 'measurement', value: 8, workOrderId: str(wb._id), procedureId: str(procB._id), submittedBy: str(actorB),
  }] }).expect(200);
  expect(await TaskResult.countDocuments({ workOrderId: wb._id })).toBe(0);
  const result = await TaskResult.findOne({ workOrderId: wa._id }).lean();
  expect(str(result.procedureId)).toBe(str(procA._id));
  expect(str(result.submittedBy)).toBe(str(actorA));
});
test('CONTROL: parts update ignores supplied actor and timestamp', async () => {
  await request(app).put(`/workorders/${wa._id}/parts/${pa._id}`).set(headers()).send({ quantity: 2, usedBy: str(actorB), usedAt: '2001-01-01' }).expect(200);
  const usage = (await WorkOrder.findById(wa._id)).partsUsed[0];
  expect(str(usage.usedBy)).toBe(str(actorA));
  expect(usage.usedAt.getUTCFullYear()).not.toBe(2001);
});
