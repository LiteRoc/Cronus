import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

// Permanent #5 regression coverage using actual routers and fail-closed synthetic persistence.
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
  if (role === 'expired') return { Authorization: `Bearer ${jwt.sign({ sub: str(actorA), role: 'technician', facilityId: str(a), facilities: [str(a)] }, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: -60 })}` };
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
  { name: 'equipment add', method: 'post', path: w => `/${w._id}/test-equipment`, scoped: false, gate: false, payload: w => ({ equipmentId: str(w.assetId), note: 'Synthetic add' }) },
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


// The frozen suite remains historical evidence; these tests assert accepted policy.
for (const op of operations) {
  for (const role of ['admin', 'technician']) {
    test(`${role}: ${op.name} within parent scope`, async () => {
      const before = await snapshot(wa._id);
      const status = op.adminOnly && role !== 'admin' ? 403 : op.success || 200;
      await send(op, wa, role).expect(status);
      if (status === 403) expect(await snapshot(wa._id)).toBe(before);
    });
  }
  test(`foreign parent denied: ${op.name}`, async () => {
    const before = await snapshot(wb._id);
    await send(op, wb, op.adminOnly ? 'admin' : 'technician').expect(404);
    expect(await snapshot(wb._id)).toBe(before);
  });
  for (const role of ['customer','viewer','tech','missing','unknown','anonymous','invalid','expired']) {
    test(`role/auth ${role}: ${op.name} denied`, async () => {
      const before = await snapshot(wa._id);
      await send(op, wa, role).expect(role === 'anonymous' ? 401 : 403);
      expect(await snapshot(wa._id)).toBe(before);
    });
  }
}
const put = body => request(app).put(`/workorders/${wa._id}`).set(headers()).send(body);
for (const field of ['timeLogs','travelLogs','partsUsed','testEquipmentUsed','procedures',
  'facilityId','assetId','workOrderNumber','contractId','createdBy','updatedBy','deletedAt','deletedBy','costs',
  'departmentId','ticketId','requestedBy','createdFrom','createdAt','updatedAt','_id','__v','vendorService','assignedTo','requestDate']) {
  test(`ordinary PUT denies protected field ${field}`, async () => {
    const before = await snapshot(wa._id);
    await put({ [field]: ['timeLogs','travelLogs','partsUsed','testEquipmentUsed','procedures'].includes(field) ? [] : str(actorB) }).expect(400);
    expect(await snapshot(wa._id)).toBe(before);
  });
}
for (const body of [
  { 'timeLogs.0.userId': 'injected' }, { 'procedures.0.taskResults': [] },
  { $set: { facilityId: 'injected' } }, { $push: { timeLogs: {} } },
  { $unset: { partsUsed: 1 } }, { description: 'valid', costs: { total: 0 } },
  { status: 'Archived' }, [], {}, { description: { $ne: null } },
]) {
  test(`ordinary PUT rejects unsafe payload ${JSON.stringify(body)}`, async () => {
    const before = await snapshot(wa._id);
    await put(body).expect(400);
    expect(await snapshot(wa._id)).toBe(before);
  });
}
test('ordinary completion workflow and editable scalar fields remain functional', async () => {
  const body = { description: 'Updated synthetic description', workOrderType: 'Corrective Maintenance',
    priority: 'High', scheduledDate: '2026-10-01T00:00:00.000Z', dueDate: '2026-10-02T00:00:00.000Z',
    status: 'Completed', completionDate: '2026-10-01T01:00:00.000Z' };
  const response = await put(body).expect(200);
  expect(response.body.workOrder).toMatchObject(body);
  expect(response.body.workOrder.updatedBy).toBe(str(actorA));
  expect(response.body.workOrder.timeLogs).toHaveLength(1);
});
for (const role of ['admin','technician']) {
  for (const kind of ['foreign','absent','malformed']) {
    test(`${role} equipment ${kind} reference cannot disclose or mutate`, async () => {
      const before = await snapshot(wa._id);
      const equipmentId = kind === 'foreign' ? str(ab._id) : kind === 'absent' ? str(oid()) : 'bad-id';
      const response = await request(app).post(`/workorders/${wa._id}/test-equipment`).set(headers(role))
        .send({ equipmentId }).expect(kind === 'malformed' ? 400 : 404);
      expect(response.body).toEqual({ error: kind === 'malformed' ? 'Invalid equipment ID' : 'Equipment not found' });
      expect(await snapshot(wa._id)).toBe(before);
    });
  }
}
test('global admin still cannot attach another Facility equipment Asset', async () => {
  const h = headers('admin'); delete h['x-facility-id'];
  await request(app).post(`/workorders/${wa._id}/test-equipment`).set(h).send({ equipmentId: str(ab._id) }).expect(404);
});
test('equipment response contains acknowledgement only; actor/time are server controlled', async () => {
  const response = await request(app).post(`/workorders/${wa._id}/test-equipment`).set(headers())
    .send({ equipmentId: str(aa._id), usedBy: str(actorB), usedAt: '2001-01-01' }).expect(200);
  expect(response.body).toEqual({ message: 'Test equipment added' });
  const wo = await WorkOrder.findById(wa._id).lean();
  expect(str(wo.testEquipmentUsed.at(-1).usedBy)).toBe(str(actorA));
  expect(wo.testEquipmentUsed.at(-1).usedAt.getUTCFullYear()).not.toBe(2001);
});
for (const endpoint of ['/parts','/test-equipment','/procedure']) {
  test(`parent denied before malformed reference ${endpoint}`, async () => {
    const method = endpoint === '/procedure' ? 'patch' : 'post';
    await request(app)[method](`/workorders/${wb._id}${endpoint}`).set(headers()).send({ partId:'bad', equipmentId:'bad', procedureId:'bad' }).expect(404);
  });
}
for (const kind of ['malformed-procedure','absent-procedure','malformed-task','absent-task','null-task']) {
  test(`safe result error ${kind}`, async () => {
    const before = await snapshot(wa._id);
    const proc = kind === 'malformed-procedure' ? 'bad-id' : kind === 'absent-procedure' ? str(oid()) : str(procA._id);
    const task = kind === 'malformed-task' ? 'bad-id' : kind === 'absent-task' ? str(oid()) : str(taskA._id);
    const response = await request(app).patch(`/workorders/${wa._id}/procedure/${proc}/task-results`).set(headers())
      .send({ taskResults: [kind === 'null-task' ? null : { taskId:task, type:'measurement', value:1 }] })
      .expect(kind.startsWith('absent') ? 404 : 400);
    expect(response.body).not.toHaveProperty('stack');
    expect(JSON.stringify(response.body)).not.toMatch(/CastError|Mongoose|workOrderRouter|node_modules/);
    expect(await snapshot(wa._id)).toBe(before);
    expect(await TaskResult.countDocuments()).toBe(0);
  });
}
for (const selected of ['bad-id','foreign','missing']) {
  test(`safe selected Facility error ${selected}`, async () => {
    let h = headers();
    if (selected === 'missing') h = headers('technician', a, { facilityId: undefined, facilities: [] });
    if (selected === 'missing') delete h['x-facility-id'];
    else h['x-facility-id'] = selected === 'foreign' ? str(b) : selected;
    await request(app).get(`/workorders/${wa._id}/parts`).set(h).expect(selected === 'foreign' ? 403 : 400);
  });
}
test('shared references remain usable without invented Facility fields or membership rules', async () => {
  expect(Part.schema.path('facilityId')).toBeUndefined();
  expect(Procedure.schema.path('facilityId')).toBeUndefined();
  expect(Task.schema.path('facilityId')).toBeUndefined();
  await request(app).post(`/workorders/${wa._id}/parts`).set(headers()).send({ partId:str(pb._id), quantity:1 }).expect(201);
  await request(app).patch(`/workorders/${wa._id}/procedure`).set(headers()).send({ procedureId:str(procB._id) }).expect(200);
  await request(app).patch(`/workorders/${wa._id}/procedure/${procA._id}/task-results`).set(headers())
    .send({ taskResults:[{taskId:str(taskB._id),type:'measurement',value:1}] }).expect(200);
});
test('fail-closed persistence refuses configured and unrelated MongoDB targets', async () => {
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued by MongoMemoryServer');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued by MongoMemoryServer');
});

test('document save cannot mutate a parent moved out of scope after lookup', async () => {
  const originalSave = WorkOrder.prototype.save;
  jest.spyOn(WorkOrder.prototype, 'save').mockImplementationOnce(async function (...args) {
    await WorkOrder.collection.updateOne({ _id: this._id }, { $set: { facilityId:b } });
    return originalSave.apply(this, args);
  });
  const response = await request(app).post(`/workorders/${wa._id}/parts`).set(headers()).send({partId:str(pa._id),quantity:2});
  expect([404,409]).toContain(response.status);
  const wo = await WorkOrder.findById(wa._id);
  expect(wo.partsUsed).toHaveLength(1);
  expect(str(wo.facilityId)).toBe(str(b));
});

for (const op of operations.filter(op => !op.scoped)) {
  for (const kind of ['malformed','absent']) {
    test(`${op.name}: safe ${kind} parent ID`, async () => {
      const response = await send(op, { ...wa, _id: kind === 'malformed' ? 'bad-id' : oid() });
      expect(response.status).toBe(kind === 'malformed' ? 400 : 404);
      expect(response.body).not.toHaveProperty('stack');
    });
  }
}
for (const name of ['parts update','parts remove','equipment remove']) {
  test(`${name}: malformed child ID rejected safely`, async () => {
    const op=operations.find(op=>op.name===name);
    let call=request(app)[op.method]('/workorders'+op.path(wa).replace(/[^/]+$/, 'bad-id')).set(headers());
    if (op.payload) call=call.send(op.payload(wa));
    await call.expect(400);
  });
}
for (const resource of ['parts','procedure']) {
  for (const kind of ['malformed','absent']) {
    test(`${resource}: safe ${kind} reference ID`, async () => {
      const id=kind==='malformed'?'bad-id':str(oid());
      await request(app)[resource==='parts'?'post':'patch'](`/workorders/${wa._id}/${resource}`).set(headers())
        .send(resource==='parts'?{partId:id,quantity:1}:{procedureId:id}).expect(kind==='malformed'?400:404);
    });
  }
}
for (const quantity of [0,-1,'invalid']) {
  test(`invalid Part quantity ${quantity} cannot mutate usage`, async () => {
    const before=await snapshot(wa._id);
    await request(app).post(`/workorders/${wa._id}/parts`).set(headers()).send({partId:str(pa._id),quantity}).expect(400);
    expect(await snapshot(wa._id)).toBe(before);
  });
}
test('equipment removal of absent valid reference remains idempotent', async () => {
  await request(app).delete(`/workorders/${wa._id}/test-equipment/${oid()}`).set(headers()).expect(200);
  expect((await WorkOrder.findById(wa._id)).testEquipmentUsed).toHaveLength(1);
});
test('parts query arguments cannot replace parent authorization', async () => {
  await request(app).get(`/workorders/${wb._id}/parts?q=x&facilityId=${a}&page=1`).set(headers()).expect(404);
  const response=await request(app).get(`/workorders/${wa._id}/parts?q=x&facilityId=${b}&page=1`).set(headers()).expect(200);
  expect(response.body).toHaveLength(1);
  expect(response.body[0].note).toBe('Private part 0');
});
test('global admin and existing generic parent visibility are preserved', async () => {
  const h=headers('admin');delete h['x-facility-id'];
  await request(app).get(`/workorders/${wb._id}/parts`).set(h).expect(200);
  await WorkOrder.collection.updateOne({_id:wa._id},{$unset:{facilityId:1}});
  await request(app).get(`/workorders/${wa._id}/parts`).set(headers()).expect(200);
});
test('global admin write still checks that parent Facility did not change after lookup', async () => {
  const originalSave=WorkOrder.prototype.save;
  jest.spyOn(WorkOrder.prototype,'save').mockImplementationOnce(async function (...args) {
    await WorkOrder.collection.updateOne({_id:this._id},{$set:{facilityId:b}});
    return originalSave.apply(this,args);
  });
  const h=headers('admin');delete h['x-facility-id'];
  const response=await request(app).post(`/workorders/${wa._id}/test-equipment`).set(h).send({equipmentId:str(aa._id)});
  expect([404,409]).toContain(response.status);
  expect((await WorkOrder.findById(wa._id)).testEquipmentUsed).toHaveLength(1);
});
test('dedicated labor deletion retains existing cost behavior for deferred #7', async () => {
  await send(operations.find(op=>op.name==='time remove'),wa).expect(200);
  const wo=await WorkOrder.findById(wa._id);
  expect(wo.timeLogs).toHaveLength(0);
  expect(wo.costs.labor).toBe(20);
  expect(wo.costs.calculatedAt).toEqual(fixedDate);
});
test('procedure attachment retains existing unit behavior for deferred #9', async () => {
  await send(operations.find(op=>op.name==='procedure attach'),wa).expect(200);
  const wo=await WorkOrder.findById(wa._id);
  expect(taskB.unit).toBe('V');
  expect(wo.procedures.find(p=>p._id.equals(procB._id)).taskResults[0].unitOfMeasure).toBeNull();
});
