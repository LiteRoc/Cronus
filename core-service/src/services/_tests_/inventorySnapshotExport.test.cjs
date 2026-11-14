const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ObjectId } = require('mongodb');
const { collectReferences, parseArgs, writeSnapshot, main, FIELDS } = require('../../../scripts/exportInventorySnapshot.cjs');
const { buildImportPlan } = require('../inventoryImportPlan');
const oid = n => n.toString(16).padStart(24, '0');
function data() {
  return {
    assets: [{ _id: new ObjectId(oid(1)), facilityId: new ObjectId(oid(2)), ctrlNumber: 'SYN-001', manufacturer: 'Synthetic Maker', serialNumber: '000964', notes: 'excluded', purchase: { price: 100 } }],
    departments: [{ _id: new ObjectId(oid(3)), facilityId: new ObjectId(oid(2)), name: 'Synthetic Dept', notes: 'excluded' }],
    equipmenttemplates: [{ _id: new ObjectId(oid(4)), manufacturer: 'Synthetic Maker', model: 'Family', di: '00123456789012', deletedAt: new Date('2026-01-01T00:00:00Z'), isArchived: false, deletedBy: new ObjectId(oid(5)), benchmark: { notes: 'excluded' } }],
    facilities: [{ _id: new ObjectId(oid(2)), name: 'Synthetic Facility', code: 'SYN', phone: 'excluded', address: { line1: 'excluded' } }],
  };
}
// This fake has only read operations. Any unexpected method (including writes)
// throws; it cannot connect or fall back to configured infrastructure.
function readOnlyDB(records = data(), { failCollection } = {}) {
  const calls = [];
  const cursor = (values, name) => ({
    sort(value) { calls.push(['sort', name, value]); return this; },
    async toArray() { return values; },
    async close() { calls.push(['cursor-close', name]); },
    async *[Symbol.asyncIterator]() {
      for (const value of values) yield value;
      if (failCollection === name) throw new Error('synthetic read failed');
    },
  });
  const db = new Proxy({
    listCollections(filter, options) {
      calls.push(['listCollections', filter, options]);
      return cursor(Object.keys(records).map(name => ({ name })), 'list');
    },
    collection(name) {
      return new Proxy({ find(filter, options) {
        calls.push(['find', name, filter, options]);
        return cursor(records[name], name);
      } }, { get(target, key) { if (!(key in target)) throw new Error(`Forbidden collection operation ${String(key)}`); return target[key]; } });
    },
  }, { get(target, key) { if (!(key in target)) throw new Error(`Forbidden database operation ${String(key)}`); return target[key]; } });
  return { db, calls };
}

test('exports only projected fields, all global assets, text identifiers, and raw archive state', async () => {
  const records = data();
  records.assets.push({ ...records.assets[0], _id: new ObjectId(oid(6)), facilityId: new ObjectId(oid(7)), ctrlNumber: 'SYN-002', isArchived: true });
  const { db, calls } = readOnlyDB(records);
  const before = JSON.stringify(records);
  const snapshot = await collectReferences(db);
  assert.equal(snapshot.assets.length, 2);
  assert.equal(snapshot.assetsScope, 'global');
  assert.equal(snapshot.assets[0].serialNumber, '000964');
  assert.equal(snapshot.templates[0].di, '00123456789012');
  assert.equal(snapshot.templates[0].isArchived, false);
  assert.equal(snapshot.templates[0].deletedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(snapshot.templates[0].deletedBy, oid(5));
  assert.equal(snapshot.assets[0].notes, undefined);
  assert.equal(snapshot.templates[0].benchmark, undefined);
  assert.equal(JSON.stringify(records), before);
  for (const [, name, filter, options] of calls.filter(c => c[0] === 'find')) {
    assert.deepEqual(filter, {});
    assert.deepEqual(Object.keys(options.projection), FIELDS[name]);
    assert.equal(options.maxTimeMS, 30000);
  }
  assert.equal(calls.filter(c => c[0] === 'find').length, 3);
  assert.equal(calls.filter(c => c[0] === 'cursor-close').length, 4);
});

test('export is directly accepted by the planner, including archive exclusions', async () => {
  const { db } = readOnlyDB();
  const snapshot = await collectReferences(db);
  const report = { valid: true, issues: [], rows: [{ row: 2, source: [], asset: { ctrlNumber: 'NEW', manufacturer: 'Synthetic Maker', model: 'Family', departmentName: 'Synthetic Dept' } }] };
  const plan = buildImportPlan(report, { facilityId: oid(2), snapshot });
  assert.equal(plan.rows[0].proposed.departmentId, oid(3));
  assert.equal(plan.rows[0].proposed.templateId, null);
  assert.equal(plan.rows[0].proposed.verifiedPurchasePrice, null);
});

test('missing collections fail closed, explicitly present empty collections are valid', async () => {
  const records = data(); delete records.departments;
  await assert.rejects(collectReferences(readOnlyDB(records).db), /departments is absent/);
  const snapshot = await collectReferences(readOnlyDB({ assets: [], departments: [], equipmenttemplates: [] }).db);
  assert.deepEqual(snapshot.assets, []);
});

test('malformed identifiers and non-text serials fail instead of being silently coerced', async () => {
  for (const change of [{ serialNumber: 964 }, { facilityId: null }, { manufacturer: '' }]) {
    const records = data(); Object.assign(records.assets[0], change);
    await assert.rejects(collectReferences(readOnlyDB(records).db));
  }
});

test('facility list has only identity fields and does not read assets, departments, or templates', async () => {
  const { db, calls } = readOnlyDB();
  const result = await collectReferences(db, { listFacilities: true });
  assert.deepEqual(result, { facilities: [{ _id: oid(2), name: 'Synthetic Facility', code: 'SYN' }] });
  assert.deepEqual(calls.filter(c => c[0] === 'find').map(c => c[1]), ['facilities']);
});

test('read failures close cursors and never return a partial snapshot', async () => {
  const { db, calls } = readOnlyDB(data(), { failCollection: 'assets' });
  await assert.rejects(collectReferences(db), /read failed/);
  assert.ok(calls.some(c => c[0] === 'cursor-close' && c[1] === 'assets'));
  assert.equal(calls.some(c => c[0] === 'find' && c[1] === 'departments'), false);
});

test('argument checks reject missing db, conflicting modes, URI flags, and system databases', () => {
  for (const args of [[], ['--db', 'admin', '--list-facilities'], ['--db', 'cronus', '--output', '--env'], ['--db', 'cronus', '--output', 'out', '--list-facilities'], ['--db', 'cronus', '--uri', 'secret'], ['--db', 'cronus', '--db', 'other']]) assert.throws(() => parseArgs(args));
  assert.equal(parseArgs(['--db', 'cronus', '--list-facilities'])['--db'], 'cronus');
});

test('snapshot writer creates private, compact JSON and refuses overwrite or oversized output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cronus-export-'));
  const file = path.join(dir, 'snapshot.json');
  try {
    writeSnapshot(file, { assets: [] });
    assert.deepEqual(JSON.parse(fs.readFileSync(file)), { assets: [] });
    if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.throws(() => writeSnapshot(file, { assets: ['replacement'] }), /new filename/);
    assert.deepEqual(JSON.parse(fs.readFileSync(file)), { assets: [] });
    assert.throws(() => writeSnapshot(path.join(dir, 'large.json'), { x: 'x'.repeat(20 * 1024 * 1024) }), /20 MiB/);
    assert.equal(fs.existsSync(path.join(dir, 'large.json')), false);
  } finally { if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
});

function dependencies(db, failAt) {
  const events = [], logs = [];
  class Client {
    constructor(uri, options) { events.push(['options', options]); }
    async connect() { events.push(['connect']); if (failAt === 'connect') throw new Error('mongodb://SECRET:DO_NOT_PRINT@host'); }
    db(name) { events.push(['db', name]); return db; }
    async close() { events.push(['close']); }
  }
  return { events, logs, env: { MONGO_URI: 'mongodb://synthetic.invalid/ignored' }, MongoClient: Client, log: message => logs.push(message), logError: message => logs.push(message) };
}

test('main closes the client before publishing, uses explicit DB and bounded majority reads', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cronus-export-main-'));
  const file = path.join(dir, 'snapshot.json');
  const dep = dependencies(readOnlyDB().db);
  try {
    assert.equal(await main(['--db', 'synthetic', '--output', file], dep), 0);
    assert.ok(fs.existsSync(file));
    assert.ok(dep.events.some(e => e[0] === 'close'));
    assert.deepEqual(dep.events.find(e => e[0] === 'db'), ['db', 'synthetic']);
    assert.deepEqual(dep.events[0][1].readConcern, { level: 'majority' });
    assert.equal(dep.events[0][1].retryReads, false);
    assert.equal(dep.logs.join('').includes('000964'), false);
  } finally { if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
});

test('connection/read failures produce no output file and never print connection details', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cronus-export-fail-'));
  const file = path.join(dir, 'snapshot.json');
  try {
    for (const dep of [dependencies(readOnlyDB().db, 'connect'), dependencies(readOnlyDB(data(), { failCollection: 'departments' }).db)]) {
      assert.equal(await main(['--db', 'synthetic', '--output', file], dep), 2);
      assert.equal(fs.existsSync(file), false);
      assert.equal(dep.logs.join('').includes('SECRET'), false);
      assert.ok(dep.events.some(e => e[0] === 'close'));
    }
  } finally { fs.rmdirSync(dir); }
});

test('help and missing config never connect, and an existing file is rejected before connecting', async () => {
  const dep = dependencies(readOnlyDB().db); dep.env = {};
  assert.equal(await main(['--help'], dep), 0);
  assert.equal(await main(['--db', 'synthetic', '--list-facilities'], dep), 2);
  assert.equal(dep.events.length, 0);
  assert.equal(await main(['--db', 'synthetic', '--output', __filename], dep), 2);
  assert.equal(dep.events.length, 0);
});

test('database-name helper shows only the explicit DB name and does not connect', async () => {
  const dep = dependencies(readOnlyDB().db);
  // Use the real driver only to parse a synthetic URI; the helper must not connect.
  const { MongoClient } = require('mongodb');
  let connections = 0;
  dep.MongoClient = class extends MongoClient {
    async connect() { connections++; throw new Error('No network allowed'); }
  };
  assert.equal(await main(['--show-database'], dep), 0);
  assert.deepEqual(dep.logs, ['ignored']);
  assert.equal(connections, 0);
  dep.logs.length = 0; dep.env.MONGO_URI = 'mongodb://synthetic.invalid';
  assert.equal(await main(['--show-database'], dep), 2);
  assert.equal(connections, 0);
  assert.equal(dep.logs.join('').includes('synthetic.invalid'), false);
});
