const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { prepareDepartmentCreation, runDepartmentCreation, createOrReuseDepartment } = require('../departmentCreation');
const oid = n => n.toString(16).padStart(24, '0');
const facilityId = oid(1), otherFacility = oid(2);
const original = () => ({ kind: 'offline-inventory-plan', facilityId, snapshot: { id: 'synthetic' }, departmentProposals: ['Imaging', 'Lab', 'Clinic'].map((name, i) => ({ facilityId, name, action: 'propose-create', status: 'pending', departmentId: null, sourceNames: [`SYN-${name}`], rows: [i + 2] })) });
const prepared = () => prepareDepartmentCreation(original());
const record = (name, i = 10, selected = facilityId) => ({ _id: oid(i), facilityId: selected, name });

test('preparation preserves provenance and preview never touches a provided API', async () => {
  const input = original(), before = structuredClone(input);
  const plan = prepareDepartmentCreation(input);
  const api = new Proxy({}, { get() { throw new Error('API must not be accessed'); } });
  const result = await runDepartmentCreation(plan, { api });
  assert.equal(result.executed, false);
  assert.deepEqual(result.requests.map(r => r.body), [{ name: 'Imaging' }, { name: 'Lab' }, { name: 'Clinic' }]);
  assert.ok(result.requests.every(r => r.headers['x-facility-id'] === facilityId));
  assert.deepEqual(plan.departments[0].sourceNames, ['SYN-Imaging']);
  assert.deepEqual(input, before);
});

test('invalid, duplicate and foreign-facility proposals are rejected before execution', async () => {
  for (const change of [{ facilityId: otherFacility }, { name: '' }, { name: 'bad\nname' }, { name: 'x'.repeat(121) }, { departmentId: oid(3) }, { status: 'created' }]) {
    const input = original(); Object.assign(input.departmentProposals[0], change);
    assert.throws(() => prepareDepartmentCreation(input));
  }
  const input = original(); input.departmentProposals[1].name = ' IMAGING ';
  assert.throws(() => prepareDepartmentCreation(input));
  await assert.rejects(runDepartmentCreation(prepared(), { execute: true, confirmFacilityId: otherFacility, api: {} }));
  await assert.rejects(runDepartmentCreation(prepared(), { execute: true, confirmFacilityId: facilityId }));
});

test('execution preflights, reuses existing names, creates missing names and returns real IDs', async () => {
  const calls = [], stored = [record(' IMAGING ')];
  const api = {
    async listDepartments(selected) { assert.equal(selected, facilityId); calls.push('list'); return structuredClone(stored); },
    async createDepartment(selected, body) {
      assert.equal(selected, facilityId); calls.push(body.name);
      const department = record(body.name, stored.length + 11); stored.push(department);
      return { department, created: true };
    },
  };
  const result = await runDepartmentCreation(prepared(), { execute: true, confirmFacilityId: facilityId, api });
  assert.deepEqual(calls, ['list', 'Lab', 'Clinic']);
  assert.deepEqual(result.results.map(r => r.status), ['reused', 'created', 'created']);
  assert.ok(result.results.every(r => /^[a-f\d]{24}$/.test(r.departmentId)));
  calls.length = 0;
  const repeated = await runDepartmentCreation(prepared(), { execute: true, confirmFacilityId: facilityId, api });
  assert.ok(repeated.results.every(r => r.status === 'reused'));
  assert.deepEqual(calls, ['list']);
});

test('ambiguous or foreign preflight results cause zero create calls', async () => {
  for (const records of [[record('Lab'), record(' lab ', 11)], [record('Imaging', 10, otherFacility)]]) {
    let writes = 0;
    const api = { async listDepartments() { return records; }, async createDepartment() { writes++; } };
    await assert.rejects(runDepartmentCreation(prepared(), { execute: true, confirmFacilityId: facilityId, api }));
    assert.equal(writes, 0);
  }
});

test('uncertain creation stops without retries, rollback, or later creates and records partial progress', async () => {
  for (const badResponse of [null, { created: true, department: record('Lab', 11, otherFacility) }]) {
    const calls = [];
    const api = {
      async listDepartments() { return []; },
      async createDepartment(selected, body) {
        calls.push(body.name);
        if (body.name === 'Lab') {
          if (badResponse) return badResponse;
          throw new Error('synthetic private token must not appear');
        }
        return { created: true, department: record(body.name) };
      },
    };
    const result = await runDepartmentCreation(prepared(), { execute: true, confirmFacilityId: facilityId, api });
    assert.deepEqual(calls, ['Imaging', 'Lab']);
    assert.deepEqual(result.results.map(r => r.status), ['created', 'reconciliation-required', 'not-attempted']);
    assert.equal(JSON.stringify(result).includes('private token'), false);
  }
});

// Load real routing, auth and ownership code, replacing ONLY database models.
// No app startup, configured database, or network service is used. Supertest's
// ephemeral loopback listener exists only for these synthetic HTTP requests.
function load(file, overrides = {}, env) {
  const resolved = path.resolve(__dirname, file), localRequire = createRequire(resolved);
  const module = { exports: {} };
  const wrapper = vm.runInThisContext(`(function(require,module,exports,process){${fs.readFileSync(resolved, 'utf8')}\n})`, { filename: resolved });
  wrapper(name => Object.hasOwn(overrides, name) ? overrides[name] : localRequire(name), module, module.exports, env ? { env } : process);
  return module.exports;
}
function fixture() {
  const rows = [], writes = [], queries = [];
  const Department = {
    find(filter) {
      queries.push(filter);
      const matching = () => rows.filter(d => d.facilityId === String(filter.facilityId));
      return { select() { return this; }, async lean() { return matching(); }, then(resolve, reject) { return Promise.resolve(matching()).then(resolve, reject); } };
    },
    async create(body) { writes.push(body); const d = record(body.name, 10 + rows.length, String(body.facilityId)); rows.push(d); return d; },
  };
  const Facility = {
    findById(value) {
      return { select() { return this; }, session() { return this; }, async lean() { return value.toLowerCase() === facilityId ? { _id: facilityId } : null; } };
    },
  };
  const scope = load('../../middleware/crmFacilityScope.js', { '../models/Facility': Facility });
  const ownership = load('../operationalOwnership.js', {
    '../models/Facility': Facility, '../models/Department': Department, '../models/Asset': {}, '../models/User': {}, '../models/EquipmentTemplate': {}, '../models/Procedure': {}, '../middleware/crmFacilityScope': scope,
  });
  const auth = load('../../middleware/authMiddleware.js', {}, { JWT_SECRET: 'synthetic-department-secret', JWT_ISS: 'synthetic', JWT_AUD: 'synthetic', NODE_ENV: 'production' });
  const router = load('../../routers/departmentRouter.js', { '../models/Department': Department, '../middleware/authMiddleware': auth, '../services/operationalOwnership': ownership });
  const app = express(); app.use(express.json()); app.use('/departments', router);
  const send = (body, role = 'admin', selected = facilityId) => {
    let query = request(app).post('/departments');
    if (role !== 'anonymous') query = query.set('Authorization', `Bearer ${jwt.sign({ sub: oid(99), role }, 'synthetic-department-secret', { issuer: 'synthetic', audience: 'synthetic' })}`);
    if (selected) query = query.set('x-facility-id', selected);
    return query.send(body);
  };
  return { rows, writes, queries, send, app, Department };
}

for (const role of ['anonymous', 'technician', 'customer', 'viewer', 'unknown']) test(`creation endpoint rejects ${role} without any writes`, async () => {
  const f = fixture(); const r = await f.send({ name: 'Imaging' }, role);
  assert.equal(r.status, role === 'anonymous' ? 401 : 403);
  assert.equal(f.writes.length, 0); assert.equal(f.queries.length, 0);
});

test('creation endpoint validates selected facility and rejects body facility conflicts and unsafe fields', async () => {
  const f = fixture();
  for (const [body, selected, status] of [[{ name: 'Imaging' }, null, 400], [{ name: 'Imaging' }, 'invalid', 400], [{ name: 'Imaging' }, otherFacility, 404], [{ name: 'Imaging', facilityId: otherFacility }, facilityId, 400], [{ name: 'Imaging', createdBy: oid(3) }, facilityId, 400], [{ name: { '$ne': null } }, facilityId, 400], [{ name: '' }, facilityId, 400]]) {
    const r = await f.send(body, 'admin', selected); assert.equal(r.status, status, JSON.stringify(r.body));
  }
  assert.equal(f.writes.length, 0);
});

test('admin creation is facility-scoped, returns IDs, and repeat requests reuse without writes', async () => {
  const f = fixture(); f.rows.push(record('Imaging', 20, otherFacility));
  const r = await f.send({ name: ' Imaging ' });
  assert.equal(r.status, 201); assert.equal(r.body.created, true);
  assert.equal(r.body.department.facilityId, facilityId);
  assert.deepEqual(f.writes, [{ name: 'Imaging', facilityId }]);
  const repeat = await f.send({ name: 'imaging' });
  assert.equal(repeat.status, 200); assert.equal(repeat.body.created, false);
  assert.equal(repeat.body.department._id, r.body.department._id);
  assert.equal(f.writes.length, 1);
  assert.ok(f.queries.every(q => q.facilityId === facilityId));
});

test('ambiguous existing names and database failures return safe errors without subsequent writes', async () => {
  const f = fixture(); f.rows.push(record('Imaging'), record('IMAGING', 11));
  const r = await f.send({ name: 'Imaging' }); assert.equal(r.status, 409); assert.equal(f.writes.length, 0);
  f.Department.find = () => { throw new Error('mongodb://private-secret'); };
  const failed = await f.send({ name: 'Lab' }); assert.equal(failed.status, 500);
  assert.equal(JSON.stringify(failed.body).includes('private-secret'), false);
});

test('creation service rejects malformed names before reading or writing', async () => {
  const noAccess = new Proxy({}, { get() { throw new Error('No model access'); } });
  await assert.rejects(createOrReuseDepartment(noAccess, facilityId, '\nInvalid'), /control characters/);
});

test('full synthetic workflow uses authenticated list/create routes and can reconcile a repeat', async () => {
  const f = fixture();
  const authorization = `Bearer ${jwt.sign({ sub: oid(99), role: 'admin' }, 'synthetic-department-secret', { issuer: 'synthetic', audience: 'synthetic' })}`;
  const api = {
    async listDepartments(selected) {
      const r = await request(f.app).get('/departments').set('Authorization', authorization).set('x-facility-id', selected);
      assert.equal(r.status, 200); return r.body;
    },
    async createDepartment(selected, body) {
      const r = await f.send(body, 'admin', selected); assert.equal(r.status, 201); return r.body;
    },
  };
  const p = prepared(), before = structuredClone(p);
  const result = await runDepartmentCreation(p, { execute: true, confirmFacilityId: facilityId, api });
  assert.equal(result.status, 'completed'); assert.equal(f.writes.length, 3);
  assert.deepEqual(f.writes.map(d => d.name), ['Imaging', 'Lab', 'Clinic']);
  assert.ok(f.writes.every(d => d.facilityId === facilityId));
  const repeat = await runDepartmentCreation(p, { execute: true, confirmFacilityId: facilityId, api });
  assert.equal(f.writes.length, 3); assert.ok(repeat.results.every(r => r.status === 'reused'));
  assert.deepEqual(p, before);
});

test('preflight errors are sanitized and cause no creation requests', async () => {
  let writes = 0;
  const api = { async listDepartments() { throw new Error('private-token'); }, async createDepartment() { writes++; } };
  await assert.rejects(runDepartmentCreation(prepared(), { execute: true, confirmFacilityId: facilityId, api }), error => !error.message.includes('private-token') && error.message.includes('no creation requests'));
  assert.equal(writes, 0);
});

test('offline preparation command produces preview only and rejects any execution flag', () => {
  const os = require('node:os'), { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cronus-department-preview-'));
  const file = path.join(dir, 'synthetic.json');
  const script = path.resolve(__dirname, '../../../scripts/prepareDepartmentCreation.cjs');
  try {
    fs.writeFileSync(file, JSON.stringify(original()));
    let result = spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.preview.executed, false); assert.equal(output.preview.requests.length, 3);
    result = spawnSync(process.execPath, [script, file, '--execute'], { encoding: 'utf8' });
    assert.equal(result.status, 2);
  } finally { fs.unlinkSync(file); fs.rmdirSync(dir); }
});
