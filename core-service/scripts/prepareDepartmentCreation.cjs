#!/usr/bin/env node
// Offline only: no live API client and no execution flag exists in this CLI.
const fs = require('node:fs');
const { prepareDepartmentCreation, runDepartmentCreation } = require('../src/services/departmentCreation');
const [file, ...extra] = process.argv.slice(2);
async function main() {
  if (!file || extra.length) throw new Error('Usage: node scripts/prepareDepartmentCreation.cjs <offline-import-plan.json>');
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error('Supply a local plan file no larger than 20 MiB.');
  const plan = prepareDepartmentCreation(JSON.parse(fs.readFileSync(file, 'utf8')));
  const preview = await runDepartmentCreation(plan);
  console.log(JSON.stringify({ plan, preview }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 2; });
