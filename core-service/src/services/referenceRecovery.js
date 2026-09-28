// Explicit administrative recovery only. No timer, TTL, startup hook or scheduler.
const mongoose = require('mongoose');
const lifecycle = require('./referenceLifecycle');
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function referenceModel(name) {
  if (!['Part', 'Manufacturer'].includes(name)) fail(400, 'Invalid reference model');
  return require(`../models/${name}`);
}
async function inspect({ referenceModel: name, referenceId, token }) {
  const Model = referenceModel(name);
  lifecycle.id(referenceId);
  if (token !== undefined && (typeof token !== 'string' || !/^[a-f\d-]{36}$/i.test(token))) fail(400, 'Invalid operation token');
  const reference = await Model.collection.findOne({ _id: new mongoose.Types.ObjectId(referenceId) },
    { projection: { referenceReservation: 1 } });
  if (!reference) fail(404, 'Reference not found');
  let reservation = reference.referenceReservation;
  if (token === undefined) {
    if (!reservation) return { referenceModel: name, referenceId, outcome: 'unreserved' };
    token = reservation.token;
  }
  const Operation = require('../models/ReferenceOperation');
  const op = typeof token === 'string' ? await Operation.collection.findOne({ _id: token,
    referenceModel: name, referenceId: reference._id }) : null;
  if (op?.state === 'released') return { referenceModel: name, referenceId, token,
    outcome: 'already-recovered', audit: op.audit };
  if (!reservation || reservation.token !== token) {
    // A journaled terminal decision can finish interrupted cleanup without touching a newer token.
    if (op?.outcome) reservation = op.reservation;
    else fail(409, 'Reservation token does not match');
  }
  const pair = lifecycle.operations[reservation.operation];
  if (!pair || pair[0] !== name || pair[1] !== reservation.destinationModel || !mongoose.isObjectIdOrHexString(reservation.destinationId) ||
      typeof reservation.writer?.instanceId !== 'string') {
    return { referenceModel: name, referenceId, token, reservation, outcome: 'uncertain' };
  }
  const committed = op?.outcome === 'committed' || await lifecycle.committedReceipt({ Model,
    referenceId: reference._id, reservation });
  return { referenceModel: name, referenceId, token, reservation,
    outcome: committed ? 'committed' : 'not-observed' };
}
function validateQuiescence(plan, evidence, actor) {
  // This is an OFFLINE operator assertion, not a lease or a conclusion inferred
  // from a missing document/PID/old timestamp. See the recovery runbook.
  if (!evidence || evidence.token !== plan.token ||
      evidence.writerInstanceId !== plan.reservation.writer?.instanceId ||
      evidence.writerStopped !== true || evidence.databaseRequestsDrained !== true ||
      evidence.verifiedBy !== actor.id || typeof evidence.evidence !== 'string' || !evidence.evidence.trim() || evidence.evidence.length > 4096) {
    fail(409, 'Abandonment requires exact-token verified writer and database-request quiescence evidence');
  }
  if (lifecycle.locallyActive(plan.reservation)) fail(409, 'Originating writer is still active');
}
async function recover(input) {
  const action = input.action || 'preview';
  if (!['preview', 'release-committed', 'abandon'].includes(action)) fail(400, 'Invalid recovery action');
  if (action !== 'preview') {
    if (typeof input.token !== 'string' || !/^[a-f\d-]{36}$/i.test(input.token)) fail(400, 'Apply requires exact token from preview');
    if (input.actor?.role !== 'admin') fail(403, 'Administrative recovery required');
    lifecycle.id(input.actor.id);
    if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 1024) fail(400, 'Recovery reason required');
  }
  let plan = await inspect(input);
  if (action === 'preview' || plan.outcome === 'already-recovered') return plan;
  if (action === 'release-committed' && plan.outcome !== 'committed') fail(409, 'Commit is not proven; reservation retained');
  if (action === 'abandon') {
    if (plan.outcome !== 'not-observed') fail(409, 'Abandonment requires absence plus quiescence; reservation retained');
    validateQuiescence(plan, input.quiescence, input.actor);
    // Recheck after the operator's quiescence evidence. Without that operational
    // precondition, this read alone would NOT close the race.
    plan = await inspect(input);
    if (plan.outcome !== 'not-observed') fail(409, 'Outcome changed; preview again');
  }
  const audit = { token: input.token, action, actorId: input.actor.id, reason: input.reason,
    at: new Date(), operation: plan.reservation.operation,
    destinationModel: plan.reservation.destinationModel, destinationId: plan.reservation.destinationId,
    writer: plan.reservation.writer, ...(action === 'abandon' ? { quiescence: { token: input.quiescence.token, writerInstanceId: input.quiescence.writerInstanceId,
      writerStopped: true, databaseRequestsDrained: true, verifiedBy: input.actor.id, evidence: input.quiescence.evidence } } : {}) };
  const cleared = await lifecycle.release({ Model: referenceModel(input.referenceModel),
    referenceId: new mongoose.Types.ObjectId(input.referenceId), reservation: plan.reservation }, audit, action === 'abandon');
  if (!cleared) {
    const current = await inspect(input);
    if (current.outcome === 'already-recovered') return current;
    fail(409, 'Reservation changed; no release performed');
  }
  return { referenceModel: input.referenceModel, referenceId: input.referenceId, token: input.token,
    outcome: 'recovered', audit };
}
module.exports = { inspect, recover };
