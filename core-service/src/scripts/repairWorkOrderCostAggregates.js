// Offline tool. Even preview database access requires separate operational approval.
const fs = require('fs');
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
const repair = require('../services/workOrderCosts/repair');

async function main() {
  const args = process.argv.slice(2);
  const value = key => args[args.indexOf(key) + 1];
  if (!args.includes('--facility-id') || !mongoose.isValidObjectId(value('--facility-id')) || !args.includes('--output')) {
    throw new Error('Require --facility-id and --output');
  }
  const limit = args.includes('--limit') ? Number(value('--limit')) : 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Batch limit must be 1..500');
  if (args.includes('--after-id') && !mongoose.isValidObjectId(value('--after-id'))) throw new Error('Invalid cursor');
  const apply = args.includes('--apply');
  if (apply && (!args.includes('--plan') || !mongoose.isValidObjectId(value('--actor-id')) || process.env.CRONUS_APPROVED_COST_REPAIR !== 'yes')) {
    throw new Error('Apply requires a reviewed plan, actor, and explicit operational approval');
  }
  if (!process.env.MONGO_URI) throw new Error('Explicit database configuration required');
  const facilityId = value('--facility-id');
  const plans = apply ? JSON.parse(fs.readFileSync(value('--plan'), 'utf8')) : [];
  if (apply && (!Array.isArray(plans) || plans.length > limit || plans.some(p => p.facilityId !== facilityId))) {
    throw new Error('Plan scope mismatch');
  }
  // Reserve a protected evidence file before any writes. Never overwrite a plan.
  const output = fs.openSync(value('--output'), 'wx', 0o600);
  try {
    await mongoose.connect(process.env.MONGO_URI);
    let results;
    if (apply) {
      const actor = await mongoose.connection.collection('users').findOne({_id:new mongoose.Types.ObjectId(value('--actor-id')), role:'admin'});
      if (!actor) throw new Error('Approved admin actor not found');
      results = [];
      for (const plan of plans) {
        if (plan.classification !== 'repairable') continue;
        const result = await repair.apply(plan, {id:String(actor._id), role:'admin'});
        const evidence = {id:plan.id, result, before:plan.before, reviewedAfter:plan.after};
        results.push(evidence);
        // Apply is a JSONL journal so a later conflict cannot lose prior outcomes.
        fs.writeSync(output, JSON.stringify(evidence) + '\n');
        fs.fsyncSync(output);
      }
    } else {
      const filter = {facilityId};
      if (args.includes('--after-id')) filter._id = {$gt:value('--after-id')};
      const rows = await WorkOrder.find(filter).sort({_id:1}).limit(limit).lean();
      results = rows.map(repair.preview);
      fs.writeSync(output, JSON.stringify(results, null, 2));
    }
    const classifications = results.reduce((counts, row) => {
      const key = row.classification || row.result;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    console.log(JSON.stringify({mode:apply?'apply':'preview', count:results.length, classifications}));
  } finally {
    fs.closeSync(output);
    await mongoose.disconnect();
  }
}
if (require.main === module) main().catch(() => {
  console.error('Cost repair stopped; no automatic retry. Review the protected evidence and audit history before resuming.');
  process.exitCode = 1;
});
