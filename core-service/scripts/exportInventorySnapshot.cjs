#!/usr/bin/env node
// Standalone read-only exporter. No app/model imports, index creation, or write commands.
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_RECORDS = 100000;
const FIELDS = Object.freeze({
  assets: ['_id', 'facilityId', 'ctrlNumber', 'manufacturer', 'serialNumber'],
  departments: ['_id', 'facilityId', 'name'],
  equipmenttemplates: ['_id', 'manufacturer', 'model', 'di', 'status', 'deletedAt', 'deletedBy', 'archivedAt', 'archivedBy', 'isArchived'],
  facilities: ['_id', 'name', 'code'],
});
class ExportError extends Error {}
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/.test(value);

function selectedRecord(raw, collection) {
  const result = {};
  for (const field of FIELDS[collection]) {
    if (!Object.hasOwn(raw, field)) continue;
    const value = raw[field];
    if (['_id', 'facilityId'].includes(field)) result[field] = typeof value?.toHexString === 'function' ? value.toHexString() : value;
    else result[field] = value;
  }
  if (!validId(result._id) || (['assets', 'departments'].includes(collection) && !validId(result.facilityId))) throw new ExportError(`Invalid identifier in ${collection}; no snapshot was written.`);
  const required = collection === 'assets' ? ['ctrlNumber', 'manufacturer'] : collection === 'equipmenttemplates' ? ['manufacturer', 'model'] : ['name'];
  if (required.some(field => typeof result[field] !== 'string' || !result[field].trim())) throw new ExportError(`Missing or non-text required field in ${collection}; no snapshot was written.`);
  for (const field of ['serialNumber', 'di']) {
    if (result[field] != null && typeof result[field] !== 'string') throw new ExportError(`Non-text ${field} in ${collection}; no snapshot was written.`);
  }
  // Preserve non-null legacy archive state, including malformed values; never cast it away.
  return JSON.parse(JSON.stringify(result));
}

async function readCollection(db, name, budget) {
  const projection = Object.fromEntries(FIELDS[name].map(field => [field, 1]));
  const cursor = db.collection(name).find({}, { projection, maxTimeMS: 30000 }).sort({ _id: 1 });
  const records = [];
  try {
    for await (const raw of cursor) {
      const record = selectedRecord(raw, name);
      budget.records++;
      budget.bytes += Buffer.byteLength(JSON.stringify(record)) + 1;
      if (budget.records > MAX_RECORDS || budget.bytes > MAX_BYTES - 4096) throw new ExportError('Reference export exceeds the supported size limit; no snapshot was written.');
      records.push(record);
    }
  } finally {
    await cursor.close();
  }
  return records;
}

async function collectReferences(db, { listFacilities = false, now = () => new Date(), uuid = randomUUID } = {}) {
  const startedAt = now().toISOString();
  const required = listFacilities ? ['facilities'] : ['assets', 'departments', 'equipmenttemplates'];
  const cursor = db.listCollections({}, { nameOnly: true });
  let names;
  try { names = new Set((await cursor.toArray()).map(c => c.name)); }
  finally { await cursor.close(); }
  for (const name of required) if (!names.has(name)) throw new ExportError(`Required collection ${name} is absent. Verify the database name; no snapshot was written.`);
  const budget = { bytes: 0, records: 0 };
  if (listFacilities) return { facilities: await readCollection(db, 'facilities', budget) };
  const assets = await readCollection(db, 'assets', budget);
  const departments = await readCollection(db, 'departments', budget);
  const templates = await readCollection(db, 'equipmenttemplates', budget);
  return {
    id: uuid(), capturedAt: startedAt, completedAt: now().toISOString(),
    assetsScope: 'global', consistency: 'sequential-majority-reads-not-a-point-in-time-backup',
    assets, departments, templates,
  };
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!['--db', '--env', '--output', '--list-facilities', '--show-database', '--help'].includes(arg) || Object.hasOwn(options, arg)) throw new ExportError('Unknown or repeated option. Use --help.');
    if (['--list-facilities', '--show-database', '--help'].includes(arg)) options[arg] = true;
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new ExportError(`A value is required for ${arg}.`);
      options[arg] = value;
    }
  }
  if (options['--help']) return options;
  if (options['--show-database']) {
    if (options['--db'] || options['--output'] || options['--list-facilities']) throw new ExportError('Use --show-database by itself, optionally with --env.');
    return options;
  }
  if (!options['--db'] || !/^[A-Za-z0-9_-]+$/.test(options['--db']) || ['admin', 'local', 'config'].includes(options['--db'].toLowerCase())) throw new ExportError('Supply the intended Cronus database name using --db (not admin, local, or config).');
  if (options['--list-facilities'] ? options['--output'] : !options['--output']) throw new ExportError('Choose --list-facilities or --output <new-file.json>.');
  return options;
}

function writeSnapshot(output, document) {
  const json = JSON.stringify(document); // Compact JSON matches the planner size limit.
  if (Buffer.byteLength(json) > MAX_BYTES) throw new ExportError('Snapshot exceeds 20 MiB; no snapshot was written.');
  let fd;
  try { fd = fs.openSync(output, 'wx', 0o600); }
  catch { throw new ExportError('Cannot create the output file. Choose a new filename in an existing writable directory. Existing files are never overwritten.'); }
  let complete = false;
  try { fs.writeFileSync(fd, json, 'utf8'); fs.fsyncSync(fd); complete = true; }
  finally {
    fs.closeSync(fd);
    if (!complete) fs.unlinkSync(output);
  }
}

const HELP = `Read-only Cronus reference exporter
  node scripts/exportInventorySnapshot.cjs [--env /path/to/.env] --show-database
  node scripts/exportInventorySnapshot.cjs --db <database> [--env /path/to/.env] --list-facilities
  node scripts/exportInventorySnapshot.cjs --db <database> [--env /path/to/.env] --output /path/to/new-snapshot.json

Reads MONGO_URI from the explicit --env file, or the existing environment when
--env is omitted. Does not load .env automatically or accept a URI argument.
Uses only collection listing and projected find operations. No app or models loaded.
Snapshot includes global assets, all departments, and shared templates including
archive metadata. The database name is explicit; use a database read-only account
when available. Files are created with private permissions and never overwritten.
Exit 0 = success; 2 = failure. No snapshot data or credentials are printed in export mode.`;

async function main(args = process.argv.slice(2), dependencies = {}) {
  const log = dependencies.log || console.log;
  const logError = dependencies.logError || console.error;
  let client;
  try {
    const options = parseArgs(args);
    if (options['--help']) { log(HELP); return 0; }
    if (options['--output'] && fs.existsSync(options['--output'])) throw new ExportError('Output file already exists. Choose a new filename; nothing was changed.');
    let config = dependencies.env || process.env;
    if (options['--env']) {
      try { config = require('dotenv').parse(fs.readFileSync(options['--env'])); }
      catch { throw new ExportError('Unable to read the explicit environment file.'); }
    }
    if (typeof config.MONGO_URI !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(config.MONGO_URI)) throw new ExportError('MONGO_URI is missing or invalid. Supply the intended environment file or environment variable.');
    const MongoClient = dependencies.MongoClient || require('mongodb').MongoClient;
    client = new MongoClient(config.MONGO_URI, {
      appName: 'cronus-readonly-inventory-snapshot', serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000, socketTimeoutMS: 45000, retryReads: false,
      readPreference: 'primary', readConcern: { level: 'majority' },
    });
    if (options['--show-database']) {
      // Confirm an explicit URI path instead of reporting the driver's default 'test'.
      if (!/^mongodb(?:\+srv)?:\/\/[^/]+\/[^?]+/.test(config.MONGO_URI)) throw new ExportError('MONGO_URI has no explicit database name. Confirm the intended database locally; do not share the connection string.');
      const databaseName = client.options.dbName;
      await client.close(); client = null;
      log(databaseName);
      return 0;
    }
    await client.connect();
    const db = client.db(options['--db']);
    const result = await collectReferences(db, { listFacilities: !!options['--list-facilities'] });
    // Close before writing so a connection/close error never reports a completed export.
    await client.close(); client = null;
    if (options['--list-facilities']) log(JSON.stringify(result, null, 2));
    else {
      writeSnapshot(options['--output'], result);
      log(`Snapshot created: ${result.assets.length} assets, ${result.departments.length} departments, ${result.templates.length} templates. No database writes performed.`);
    }
    return 0;
  } catch (error) {
    // Driver errors may contain connection strings or credentials. Never echo them.
    logError(error instanceof ExportError ? error.message : 'Export failed. No completed snapshot was produced. Check database access, read permissions, and file permissions locally; connection details were withheld.');
    return 2;
  } finally {
    if (client) { try { await client.close(); } catch { /* Never print driver exceptions. */ } }
  }
}

if (require.main === module) main().then(code => { process.exitCode = code; });
module.exports = { collectReferences, parseArgs, writeSnapshot, main, ExportError, FIELDS };
