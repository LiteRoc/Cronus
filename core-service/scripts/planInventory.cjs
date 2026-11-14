#!/usr/bin/env node
const fs = require('node:fs');
const { parseExcel } = require('../src/services/inventoryImport');
const { buildImportPlan } = require('../src/services/inventoryImportPlan');

function readLocal(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error('Inputs must be local files no larger than 20 MiB.');
  return fs.readFileSync(file);
}

const [file, facilityId, snapshotFile, ...tail] = process.argv.slice(2);
const sheetName = tail.length && !tail[0].startsWith('--') ? tail.shift() : undefined;
const mappingFile = tail.length === 2 && tail[0] === '--department-mappings' ? tail[1] : undefined;
if (!file || !facilityId || !snapshotFile || (tail.length && !mappingFile)) {
  console.error('Usage: node scripts/planInventory.cjs <export.xlsx> <facility-id> <snapshot.json|-> [worksheet-name] [--department-mappings mappings.json]');
  process.exitCode = 2;
} else {
  try {
    const snapshot = snapshotFile === '-' ? null : JSON.parse(readLocal(snapshotFile).toString('utf8'));
    const report = parseExcel(readLocal(file), { sheetName });
    const departmentMappings = mappingFile ? JSON.parse(readLocal(mappingFile).toString('utf8')) : [];
    const plan = buildImportPlan(report, { facilityId, snapshot, departmentMappings });
    console.log(JSON.stringify(plan, null, 2));
    process.exitCode = plan.summary.blocked || plan.summary.review ? 1 : 0;
  } catch (error) {
    console.error(`Unable to plan inventory: ${error.message}`);
    process.exitCode = 2;
  }
}
