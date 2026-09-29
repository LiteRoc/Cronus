const WorkOrder = require('../models/WorkOrder');
const measurements = require('./procedureMeasurements');
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };

// A single WorkOrder document is the commit boundary. This revision serializes
// attachments, submissions, removals and completion without a second collection
// write or any replica-set requirement. Legacy rows are not rewritten on reads.
async function mutate(filter, actor, change) {
  const before = await WorkOrder.findOne({ ...filter, deletedAt: null }).lean();
  if (!before) fail(404, 'Work order not found');
  const { procedures, procedureUpdate, ...patch } = await change(before);
  // Validate raw input before Mongoose can cast objects into status strings.
  if (Object.prototype.hasOwnProperty.call(patch, 'status') &&
      (typeof patch.status !== 'string' || !['Open', 'In Progress', 'Completed', 'Requested'].includes(patch.status))) {
    fail(400, 'Invalid status');
  }
  if (patch.status === 'Completed' || (procedures && before.status === 'Completed')) {
    measurements.assertComplete(procedures ?? before.procedures);
  }
  const { $set: resultFields = {}, ...operators } = procedureUpdate || {};
  const revision = before.procedureResultsRevision;
  const updated = await WorkOrder.findOneAndUpdate(
    { ...filter, deletedAt: null, status: before.status,
      procedureResultsRevision: revision === undefined ? { $exists: false } : revision },
    // Target only the explicit edit. Recasting the entire array would add
    // defaults/drop unknown fields in unrelated legacy execution records.
    { ...operators, $set: { ...patch, ...resultFields, updatedBy: actor }, $inc: { procedureResultsRevision: 1 } },
    { new: true, runValidators: true }
  );
  if (!updated) fail(409, 'Work order changed; reload and retry');
  return updated;
}

function findProcedure(workOrder, procedureId) {
  const matches = (workOrder.procedures || []).filter(p => String(p._id) === String(procedureId));
  if (!matches.length) fail(404, 'Procedure not attached to work order');
  if (matches.length !== 1) fail(409, 'Ambiguous legacy procedure attachments require review');
  return matches[0];
}

function submit(workOrder, procedureId, incoming, actor) {
  const procedure = findProcedure(workOrder, procedureId);
  const attached = procedure.taskResults || [];
  const ids = incoming.map(row => String(row.taskId));
  if (new Set(ids).size !== ids.length) fail(400, 'Duplicate task results');
  for (const id of ids) {
    if (attached.filter(row => String(row.taskId) === id).length !== 1) fail(404, 'Task must identify one attached result');
  }
  const byId = new Map(incoming.map(row => [String(row.taskId), row]));
  const now = new Date();
  const procedureIndex = workOrder.procedures.indexOf(procedure);
  const fields = {};
  const taskResults = attached.map((row, index) => {
    if (!byId.has(String(row.taskId))) return row;
    const updated = measurements.submit(row, byId.get(String(row.taskId)), actor, now);
    const keys = ['value', 'passed', 'completed', 'resultVersion', 'comment', 'submittedBy', 'submittedAt'];
    if (row.measurementSnapshot) keys.push('unitOfMeasure');
    for (const key of keys) fields[`procedures.${procedureIndex}.taskResults.${index}.${key}`] = updated[key];
    return updated;
  });
  return {
    procedures: workOrder.procedures.map(p => p === procedure ? { ...p, taskResults } : p),
    procedureUpdate: { $set: fields },
  };
}

module.exports = { mutate, findProcedure, submit, fail };
