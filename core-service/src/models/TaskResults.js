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

module.exports = mongoose.model('TaskResult', taskResultSchema);