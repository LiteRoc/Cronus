#!/usr/bin/env node
// Offline only. This command never accepts an execution flag or loads credentials.
const fs = require('node:fs');
const { prepareAssetCreation, runAssetCreation } = require('../src/services/assetCreation');
const [file, ...extra] = process.argv.slice(2);
async function main() {
  if (!file || extra.length) throw new Error('Usage: node scripts/prepareAssetCreation.cjs <offline-import-plan.json>');
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error('Supply a local plan no larger than 20 MiB.');
  const plan = prepareAssetCreation(JSON.parse(fs.readFileSync(file, 'utf8')));
  console.log(JSON.stringify({ plan, preview: await runAssetCreation(plan) }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 2; });
