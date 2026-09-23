const WorkOrder = require('../../models/WorkOrder');
const engine = require('./calculate');
const context = require('./context');
function preview(w) {
  if (w.economics?.schemaVersion !== 1 || !['native', 'import'].includes(w.economics.origin)) return {
    id: String(w._id),
    facilityId: String(w.facilityId),
    classification: 'legacy_ambiguous'
  };
  const state = engine.read(w);
  if (state.cacheState === 'unsupported') return {
    id: String(w._id),
    facilityId: String(w.facilityId),
    classification: 'unsupported'
  };
  if (state.cacheState === 'current') return {
    id: String(w._id),
    facilityId: String(w.facilityId),
    classification: 'unchanged'
  };
  if (state.scopes.directMaintenance.missingComponents.some(m => ['snapshot_amount_conflict', 'unverified_snapshot', 'invalid_amount'].includes(m.reason))) return {
    id: String(w._id),
    facilityId: String(w.facilityId),
    classification: 'conflicting_snapshots'
  };
  return {
    id: String(w._id),
    facilityId: String(w.facilityId),
    classification: 'repairable',
    inputRevision: w.economics.revision,
    inputFingerprint: engine.fingerprint(w),
    before: w.costs || null,
    after: engine.calculate(w)
  };
}
async function apply(plan, actor) {
  if (actor?.role !== 'admin') throw new Error('Admin repair authorization required');
  const w = await WorkOrder.findOne({
    _id: plan.id,
    facilityId: plan.facilityId
  }).lean();
  if (!w) throw new Error('Repair target not found');
  if (engine.fingerprint(w) !== plan.inputFingerprint || w.economics?.revision !== plan.inputRevision) throw new Error('Repair inputs changed');
  const current = preview(w);
  if (current.classification === 'unchanged') return 'no-op';
  if (current.classification !== 'repairable' || JSON.stringify(engine.stable(w.costs || null)) !== JSON.stringify(engine.stable(plan.before))) throw new Error('Repair plan no longer applicable');
  const after = engine.calculate(w);
  const audit = {
    actor: actor.id,
    at: new Date(),
    reason: 'aggregate-only repair',
    before: w.costs || null,
    after,
    inputRevision: plan.inputRevision
  };
  const result = await context.run(() => WorkOrder.updateOne({
    _id: w._id,
    facilityId: w.facilityId,
    'economics.revision': plan.inputRevision,
    costs: w.costs ?? {
      $exists: false
    }
  }, {
    $set: {
      costs: after
    },
    $push: {
      costRepairHistory: audit
    }
  }).exec());
  if (result.modifiedCount !== 1) throw new Error('Concurrent repair conflict');
  return 'repaired';
}
module.exports = {
  preview,
  apply
};
