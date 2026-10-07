// Offline, preview-first. Real-data use requires separate operational authorization.
const fs = require('node:fs');
const mongoose = require('mongoose');
const {validateOptions, runLifecycleCacheOperator} = require('../services/lifecycleCacheOperator');
function parseArgs(args) {
  const input = {mode: 'preview', assetIds: []};
  const names = {'--facility-id': 'facilityId', '--actor-id': 'actorId', '--max-assets': 'maxAssets', '--page-size': 'pageSize', '--after-id': 'afterId', '--output': 'output'};
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (['--preview', '--apply'].includes(flag)) {
      if (seen.has('mode')) throw Error('Specify only one mode');
      seen.add('mode'); input.mode = flag === '--apply' ? 'apply' : 'preview'; continue;
    }
    if (!(flag in names) && flag !== '--asset-id' || !args[i + 1] || args[i + 1].startsWith('--')) throw Error('Unknown flag or missing value');
    const value = args[++i];
    if (flag === '--asset-id') {input.assetIds.push(value); continue;}
    if (seen.has(flag)) throw Error('Duplicate option');
    seen.add(flag); input[names[flag]] = ['--max-assets', '--page-size'].includes(flag) && /^\d+$/.test(value) ? Number(value) : value;
  }
  if (!input.output) throw Error('Require --output');
  return {...validateOptions(input), output: input.output};
}
async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Offline lifecycle cache operator: --preview (default) | --apply\nRequired: --facility-id ID --actor-id ADMIN_ID --max-assets 1..10000 --output NEW_FILE\nScope: repeat --asset-id ID for exact membership; otherwise bounded Facility traversal\nOptional: --page-size 1..250 (default 100), --after-id ID (traversal only)\nApply requires CRONUS_APPROVED_LIFECYCLE_REFRESH=yes. Separate operational approval is required for any real-data invocation.');
    return;
  }
  const options = parseArgs(args);
  if (options.mode === 'apply' && process.env.CRONUS_APPROVED_LIFECYCLE_REFRESH !== 'yes') throw Error('Apply requires explicit operational approval');
  if (!process.env.MONGO_URI) throw Error('Explicit database configuration required');
  mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
  const output = fs.openSync(options.output, 'wx', 0o600);
  try {
    let result;
    try {
      await mongoose.connect(process.env.MONGO_URI);
      result = await runLifecycleCacheOperator(options);
    }
    catch (error) {
      result = error.result ?? {state: 'failed', mode: options.mode, reason: 'operator_or_database_failure',
        requestedAssetIds: options.assetIds, facilityId: options.facilityId};
      process.exitCode = 1;
    }
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    if (result.state !== 'completed') process.exitCode = 1;
    console.log(`Lifecycle cache ${options.mode}: ${result.state}; structured evidence written to output`);
  } finally { await mongoose.disconnect(); fs.closeSync(output); }
}
if (require.main === module) main().catch(() => {console.error('Lifecycle cache invocation failed; reconcile output before retry'); process.exitCode = 1;});
module.exports = {main, parseArgs};
