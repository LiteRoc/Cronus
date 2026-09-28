// Offline, preview-first tool. Even preview against real data needs separate approval.
const fs = require('node:fs');
const mongoose = require('mongoose');
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Preview: --model Part|Manufacturer --id ID [--token TOKEN] --output FILE\nApply: add --apply --action release-committed|abandon --actor-id ID --reason TEXT\nAbandon also requires --quiescence FILE; read the recovery runbook first.');
    return;
  }
  const value = key => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
  const apply = args.includes('--apply');
  const input = { referenceModel: value('--model'), referenceId: value('--id'), token: value('--token'),
    action: apply ? value('--action') : 'preview' };
  if (!['Part', 'Manufacturer'].includes(input.referenceModel) || !mongoose.isObjectIdOrHexString(input.referenceId) ||
      (input.token !== undefined && !/^[a-f\d-]{36}$/i.test(input.token)) || !value('--output')) throw Error('Require valid model, id, token and output');
  if (apply && (process.env.CRONUS_APPROVED_REFERENCE_RECOVERY !== 'yes' || !input.token ||
      !['release-committed','abandon'].includes(input.action) || !mongoose.isObjectIdOrHexString(value('--actor-id')) || !value('--reason'))) {
    throw Error('Apply requires explicit approval, action, administrator and reason');
  }
  if (apply && input.action === 'abandon') {
    if (!value('--quiescence')) throw Error('Abandon requires reviewed quiescence evidence');
    input.quiescence = JSON.parse(fs.readFileSync(value('--quiescence'), 'utf8'));
  }
  if (!process.env.MONGO_URI) throw Error('Explicit database configuration required');
  // Never load dotenv, application startup, schedulers, or automatically create indexes.
  mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
  const output = fs.openSync(value('--output'), 'wx', 0o600);
  try {
    await mongoose.connect(process.env.MONGO_URI);
    if (apply) {
      const user = await require('../models/User').findById(value('--actor-id')).select('_id role').lean();
      if (!user || user.role !== 'admin') throw Error('Actor must be an existing administrator');
      input.actor = { id: String(user._id), role: user.role }; input.reason = value('--reason');
    }
    const result = await require('../services/referenceRecovery').recover(input);
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(`Recovery ${result.outcome}; evidence written to requested output file`);
  } finally { await mongoose.disconnect(); fs.closeSync(output); }
}
if (require.main === module) main().catch(() => { console.error('Recovery failed; reservation outcome must be inspected before any retry'); process.exitCode = 1; });
module.exports = { main };
