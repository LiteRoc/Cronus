// Database-free probe: real batch orchestration, synthetic dependency responses.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const canonical = require('../../src/services/assetLifecycleAssessment');
const fixed = process.argv.includes('--fixed');
const root = path.resolve(__dirname, '../../src/services');
const source = fs.readFileSync(fixed ? path.join(root, 'assetLifecycleAssessmentBatch.js') : path.join(__dirname, 'baseline-batch.cjs'), 'utf8');
const cacheSource = fs.readFileSync(fixed ? path.join(root, 'lifecycleCache.js') : path.join(__dirname, 'baseline-cache.cjs'), 'utf8');
const aid = '000000000000000000000001', tid = '000000000000000000000002';
const template = {_id: tid, manufacturer: 'Synthetic', lifecycleDefaults: {expectedLifeYears: 8}, benchmark: {averageQuotedPrice: 5000, source: 'synthetic', reportDate: '2025-01-01'}};
let policies = [];
const query = value => ({select: () => ({lean: async () => value()})});
const totals = {lifetime: {total: 0, count: 0}, last12Months: {total: 0, count: 0}};
const moduleBox = {exports: {}};
const localRequire = name => {
  if (name === '../models/Facility') return {findById: () => query(() => ({organizationId: 'synthetic-org'}))};
  if (name === '../models/Organization') return {findById: () => query(() => ({lifecyclePolicies: policies}))};
  if (name === './lifecycleMaintenance') return {default: {getMaintenanceTotalsBatch: async () => new Map([[aid, totals]])}};
  if (name === './lifecycleAggregation') return {maintenanceWindow: () => ({start: '2025-10-07'})};
  return require(path.join(root, name));
};
vm.runInNewContext(source, {require: localRequire, module: moduleBox, Date, Map, String});
async function run() {
  const fields = fixed ? require('../../src/services/lifecycleTemplateShape').TEMPLATE_FIELDS : vm.runInNewContext(cacheSource.match(/const TEMPLATE_FIELDS = (\[[^;]+\]);/)[1]);
  const projected = Object.fromEntries(fields.filter(f => template[f] !== undefined).map(f => [f, template[f]]));
  const asset = {_id: aid, facilityId: 'synthetic-facility', serviceStartDate: '2010-01-01'};
  const asOf = new Date('2026-10-07T00:00:00Z');
  const assess = async t => (await moduleBox.exports.assessAssets([{...asset, templateId: t}], {asOf})).get(aid).assessment;
  const result = {template: {live: await assess(template), refresh: await assess(projected)}};
  policies = [{templateId: tid, sourceType: 'organization_policy', expectedLifeYears: 6, reference: 'synthetic-approved', approvedBy: aid, approvedAt: '2025-01-01'}];
  result.policy = {live: await assess(template), refresh: await assess(projected)};
  const equal = Object.values(result).every(pair => JSON.stringify(pair.live) === JSON.stringify(pair.refresh));
  if (equal !== fixed) throw Error('Unexpected parity result');
  console.log(JSON.stringify({fixed, equal, result}, null, 2));
}
run().catch(error => {console.error(error.message); process.exitCode = 1;});
