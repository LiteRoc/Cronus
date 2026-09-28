// Shared Part/Manufacturer policy: status labels never determine archive state.
const mongoose = require('mongoose');
const Operation = require('../models/ReferenceOperation');
const durable = { writeConcern: { w: 1, j: true } };

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function id(value) {
  if (typeof value !== 'string' || !mongoose.isObjectIdOrHexString(value)) fail(400, 'Invalid reference ID');
  return value;
}
function businessFields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid request body');
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) fail(400, 'Field is not editable');
  }
  // Ordinary fields cannot contain Mongo operators, dotted paths or prototype keys.
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key)) {
        fail(400, 'Invalid request field');
      }
      inspect(child);
    }
  }
  inspect(body);
  return { ...body };
}
async function activeRecord(Model, value) {
  const record = await Model.findById(id(value));
  if (!record) fail(404, `${Model.modelName} not found`);
  if (record.deletedAt != null) fail(409, `${Model.modelName} is archived`);
  return record;
}
function receipt(handle) {
  return { token: handle.reservation.token, operation: handle.reservation.operation,
    referenceModel: handle.Model.modelName, referenceId: handle.referenceId, at: new Date() };
}
function notWritten(status, message) {
  const error = new Error(message);
  error.status = status; error.referenceNotWritten = true;
  throw error;
}
async function updateActive(Model, value, fields, actor, handle = null) {
  const filter = { _id: id(value), deletedAt: null, referenceReservation: null };
  const update = { $set: { ...fields, updatedBy: actor } };
  if (handle) {
    Object.assign(filter, destinationGuard(handle));
    Object.assign(update.$set, destinationStamp(handle));
    handle.writeStarted = true;
  }
  const record = await Model.findOneAndUpdate(filter, update,
    { new: true, runValidators: true, ...(handle ? { writeConcern: { w: 1, j: true } } : {}) });
  if (!record) {
    // No destination write happened; do not release on uncertain database errors.
    try { await activeRecord(Model, value); }
    catch (error) { error.referenceNotWritten = true; throw error; }
    notWritten(409, 'Record is reserved or changed; retry');
  }
  return record;
}
async function archive(Model, value, actor, status) {
  const record = await Model.findOneAndUpdate(
    { _id: id(value), deletedAt: null, referenceReservation: null },
    { $set: { deletedAt: new Date(), deletedBy: actor, updatedBy: actor, status } },
    { new: true, runValidators: true, writeConcern: { w: 1, j: true } }
  );
  if (record) return record;
  const existing = await Model.findById(value);
  if (!existing) fail(404, `${Model.modelName} not found`);
  if (existing.deletedAt != null) return existing; // Idempotent, no audit rewrite.
  fail(409, 'Reference is reserved; archive blocked');
}

const { randomUUID } = require('node:crypto');
const writer = Object.freeze({ instanceId: randomUUID(), host: require('node:os').hostname(), pid: process.pid });
const activeTokens = new Set();
const operations = {
  'part-create': ['Manufacturer', 'Part'],
  'part-manufacturer-update': ['Manufacturer', 'Part'],
  'workorder-part-add': ['Part', 'WorkOrder'],
};
async function acquire(Model, value, operation, destinationId) {
  id(value); id(destinationId);
  const pair = operations[operation];
  if (!pair || pair[0] !== Model.modelName) fail(400, 'Invalid reference operation');
  const reservation = { token: randomUUID(), operation, destinationModel: pair[1],
    destinationId: new mongoose.Types.ObjectId(destinationId), acquiredAt: new Date(), writer };
  const catalog = await Model.findOneAndUpdate(
    { _id: value, deletedAt: null, referenceReservation: null },
    { $set: { referenceReservation: reservation } },
    { new: true, runValidators: true, timestamps: false, writeConcern: { w: 1, j: true } }
  ).lean();
  if (!catalog) {
    try { await activeRecord(Model, value); }
    catch (error) {
      if (Model.modelName === 'Part' && error.status === 409) fail(404, 'Part not found or archived');
      throw error;
    }
    fail(409, 'Reference is reserved; retry');
  }
  const Destination = require(`../models/${pair[1]}`);
  const previous = await Destination.collection.findOne({ _id: reservation.destinationId },
    { projection: { referenceFence: 1 } });
  const handle = { Model, referenceId: new mongoose.Types.ObjectId(value), reservation, catalog,
    expectedFence: previous?.referenceFence ?? null, writeStarted: false };
  // No dependent write is dispatched until its immutable fence is journaled.
  await Operation.collection.insertOne({ _id: reservation.token, referenceModel: Model.modelName,
    referenceId: handle.referenceId, reservation, expectedFence: handle.expectedFence, state: 'reserved' }, durable);
  return handle;
}
function destinationGuard(handle) {
  return { referenceReceipt: null, referenceFence: handle.expectedFence ?? null };
}
function destinationStamp(handle) {
  return { referenceReceipt: receipt(handle), referenceFence: handle.reservation.token };
}
async function operation(handle) {
  return Operation.collection.findOne({ _id: handle.reservation.token,
    referenceModel: handle.Model.modelName, referenceId: handle.referenceId });
}
async function committedReceipt(handle) {
  const Destination = require(`../models/${handle.reservation.destinationModel}`);
  return Destination.collection.findOne({ _id: handle.reservation.destinationId,
    'referenceReceipt.token': handle.reservation.token,
    'referenceReceipt.operation': handle.reservation.operation,
    'referenceReceipt.referenceModel': handle.Model.modelName,
    'referenceReceipt.referenceId': handle.referenceId }, { projection: { _id: 1 } });
}
async function release(handle, audit = null, absent = false) {
  let op = await operation(handle);
  if (op?.state === 'released') return true;
  const committed = op?.outcome === 'committed' || await committedReceipt(handle);
  if (!committed && !absent && op?.outcome !== 'absent') fail(409, 'Outcome uncertain; reservation retained');
  const outcome = committed ? 'committed' : 'absent';
  // Journal the proof and bounded audit BEFORE removing any business-document evidence.
  if (!op) {
    try {
      await Operation.collection.insertOne({ _id: handle.reservation.token,
        referenceModel: handle.Model.modelName, referenceId: handle.referenceId,
        reservation: handle.reservation, state: 'reserved' }, durable);
    } catch (e) { if (e.code !== 11000) throw e; }
    op = await operation(handle);
    if (!op) fail(409, 'Operation identity mismatch');
  }
  await Operation.collection.updateOne({ _id: op._id, state: 'reserved' },
    { $set: { state: outcome, outcome, ...(audit ? { audit } : {}) } }, durable);
  op = await operation(handle);
  if (op.outcome !== outcome) fail(409, 'Operation outcome changed');
  if (audit) await Operation.collection.updateOne({ _id: op._id, audit: { $exists: false } },
    { $set: { audit } }, durable);
  // Replay cannot pass the old fence even after the single receipt is removed.
  const Destination = require(`../models/${handle.reservation.destinationModel}`);
  await Destination.collection.updateOne({ _id: handle.reservation.destinationId,
    'referenceReceipt.token': handle.reservation.token }, { $unset: { referenceReceipt: 1 } }, durable);
  await handle.Model.updateOne(
    { _id: handle.referenceId, 'referenceReservation.token': handle.reservation.token },
    { $unset: { referenceReservation: 1 } },
    { timestamps: false, runValidators: true, ...durable });
  await Operation.collection.updateOne({ _id: op._id, state: outcome }, { $set: { state: 'released' } }, durable);
  return true;
}
async function withReservation(Model, value, operation, destinationId, write) {
  const handle = await module.exports.acquire(Model, value, operation, destinationId);
  activeTokens.add(handle.reservation.token);
  try {
    let result;
    try {
      result = await write(handle);
    } catch (error) {
      // Only definitive single-write failures permit cleanup. Unknown outcomes
      // retain the reservation; never perform cleanup in an unconditional finally.
      const noWrite = !handle.writeStarted || error.referenceNotWritten ||
        ['ValidationError', 'CastError', 'StrictModeError'].includes(error.name) || error.code === 11000;
      if (noWrite) await module.exports.release(handle, null, true);
      throw error;
    }
    await module.exports.release(handle);
    return result;
  } finally {
    activeTokens.delete(handle.reservation.token); // Process bookkeeping, NOT DB release.
  }
}
function locallyActive(reservation) {
  return reservation.writer?.instanceId === writer.instanceId && activeTokens.has(reservation.token);
}
function respond(res, error, fallback) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (['CastError', 'ValidationError', 'StrictModeError'].includes(error.name)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (error.code === 11000) return res.status(400).json({ error: 'Value must be unique' });
  return res.status(500).json({ error: fallback });
}
module.exports = { id, businessFields, activeRecord, updateActive, archive, acquire, release,
  withReservation, receipt, destinationGuard, destinationStamp, operation, committedReceipt, notWritten, operations, locallyActive, respond };
