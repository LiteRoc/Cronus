// src/models/TaskResults.js

const mongoose = require('mongoose');

const taskResultSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
  procedureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Procedure', required: true },
  type: { type: String, enum: ['pass/fail', 'measurement', 'comment'], required: true },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  minValue: { type: Number },
  maxValue: { type: Number },
  unitOfMeasure: { type: String },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

// The collection is historical evidence only. Current TaskResult reads project
// WorkOrder's canonical reading; no independently writable second copy exists.
taskResultSchema.statics.fromWorkOrder = function (workOrder, procedureId) {
  const source = workOrder.toObject ? workOrder.toObject() : workOrder;
  return (source.procedures || []).filter(p => String(p._id) === String(procedureId))
    .flatMap(p => (p.taskResults || []).map(row => ({
      taskId: row.taskId, workOrderId: source._id, procedureId: p._id,
      type: row.type, result: row.value, unitOfMeasure: row.unitOfMeasure ?? null,
      measurementSnapshot: row.measurementSnapshot,
      minValue: row.measurementSnapshot?.minValue ?? null,
      maxValue: row.measurementSnapshot?.maxValue ?? null,
      passed: row.passed ?? null, completed: row.completed,
      submittedBy: row.submittedBy, timestamp: row.submittedAt,
      source: row.resultVersion === 1 ? 'workOrder' : 'legacyEmbedded',
    })));
};

module.exports = mongoose.model('TaskResult', taskResultSchema);
