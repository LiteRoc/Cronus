// src/models/WorkOrder.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

const Counter = require('./Counter');

const TimeLogSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timeSpent: { type: Number, min: 1, required: true }, // minutes
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },

  // NEW: labor cost snapshot
  laborRate: { type: Number, min: 0, default: 0 }, // $/hour
  laborCost: { type: Number, min: 0, default: 0 }, // computed: minutes/60 * rate
});

const TravelLogSchema = new Schema({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  travelTime: { type: Number, min: 1, required: true }, // minutes
  note:       { type: String, default: '' },
  createdAt:  { type: Date, default: Date.now },
});

const TaskResultSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  label: { type: String },
  type: { type: String, enum: ['pass/fail', 'measurement', 'comment'], required: true },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
  unitOfMeasure: { type: String, default: null },
  passed: { type: Boolean, default: null },
  comment: { type: String, default: '' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedAt: { type: Date, default: null },
}, { _id: false });

const PartUsageSchema = new mongoose.Schema({
  partId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Part', required: true },
  quantity: { type: Number, min: 1, required: true },
  note:     { type: String, default: '' },

  // NEW: cost snapshot fields
  unitCost: { type: Number, min: 0, default: 0 },
  extendedCost: { type: Number, min: 0, default: 0 },

  usedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  usedAt:   { type: Date, default: Date.now },
}, { _id: false });

const WorkOrderSchema = new Schema({
  // tenant + identity
  facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  assetId:        { type: Schema.Types.ObjectId, ref: 'Asset', required: true, index: true },
  workOrderNumber:{ type: Number, index: true }, // if you use incrementing numbers
  workOrderType:  { type: String, default: 'Corrective Maintenance' },

  // core
  description:    { type: String, required: true },
  status:         { type: String, enum: ['Open', 'In Progress', 'Completed', 'Requested', 'Archived'], default: 'Open', index: true },
  priority:       { type: String, enum: ['Low', 'Normal', 'High', 'Critical'], default: 'Normal' },

  // dates
  requestDate:    { type: Date, default: Date.now, index: true },
  scheduledDate:  { type: Date },
  dueDate:        { type: Date, index: true },
  completionDate: { type: Date },

  // assignment
  assignedTo:     { type: Schema.Types.ObjectId, ref: 'User' },
  contractId:     { type: mongoose.Schema.Types.ObjectId },


  // NEW: soft link back to the ticket that originated this WO (if any)
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },

  // procedures: attach a procedures and store taskResults under it
  procedures: [{
    _id:         { type: Schema.Types.ObjectId, ref: 'Procedure' },
    name:        { type: String }, // denormalize for fast display
    taskResults: [TaskResultSchema],
  }],

  // logs
  timeLogs:   { type: [TimeLogSchema], default: [] },
  travelLogs: { type: [TravelLogSchema], default: [] },

  // parts used
  partsUsed: { type: [PartUsageSchema], default: [] },

  //test equipment used
  testEquipmentUsed: [
    { 
      equipmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true }, 
      usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
      usedAt: { type: Date, default: Date.now }, 
      note: { type: String }, 
    },
  ],

  // optional fields for better analytics & lifecycle management
  costs: {
    labor: { type: Number, min: 0, default: 0 },
    parts: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, default: 0 },
    calculatedAt: { type: Date, default: null },
  },


  // soft delete + audit
  deletedAt:  { type: Date, default: null, index: true },
  deletedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },

  createdBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },

  // NEW: simple provenance for analytics/audit
  createdFrom: { 
    type: String, 
    enum: ['manual', 'ticket', 'automation', 'api'], 
    default: 'manual' 
  },

  // NEW (optional but handy): who asked for it (copied from Ticket if present)
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// indexes that matter
WorkOrderSchema.index({ facilityId: 1, status: 1, dueDate: 1 });
WorkOrderSchema.index({ ticketId: 1 }); // for quick joins & lookups
WorkOrderSchema.index({ workOrderNumber: 1 }, { unique: true, sparse: true }); // if using sequential numbers
WorkOrderSchema.index({ assetId: 1, status: 1, deletedAt: 1, completionDate: 1 });

WorkOrderSchema.pre('save', async function (next) {
  if (!this.isNew || this.workOrderNumber) return next();

  if (!Array.isArray(this.timeLogs)) this.timeLogs = [];
  if (!Array.isArray(this.travelLogs)) this.travelLogs = [];

  // Per-facility sequence
  const counterId = 'wo:global';
  const c = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  this.workOrderNumber = c.seq;
  next();
});

WorkOrderSchema.add({
  partsUsed: [PartUsageSchema],
});

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

WorkOrderSchema.pre('save', function (next) {
  // parts extended cost (in case caller didn’t compute)
  if (Array.isArray(this.partsUsed)) {
    for (const p of this.partsUsed) {
      const qty = Number(p.quantity) || 0;
      const unit = Number(p.unitCost) || 0;
      p.extendedCost = round2(qty * unit);
    }
  }

  // labor cost (in case caller didn’t compute)
  if (Array.isArray(this.timeLogs)) {
    for (const t of this.timeLogs) {
      const mins = Number(t.timeSpent) || 0;
      const rate = Number(t.laborRate) || 0;
      t.laborCost = round2((mins / 60) * rate);
    }
  }

  const labor = round2((this.timeLogs || []).reduce((sum, t) => sum + (Number(t.laborCost) || 0), 0));
  const parts = round2((this.partsUsed || []).reduce((sum, p) => sum + (Number(p.extendedCost) || 0), 0));

  this.costs = this.costs || {};
  this.costs.labor = labor;
  this.costs.parts = parts;
  this.costs.total = round2(labor + parts);
  this.costs.calculatedAt = new Date();

  next();
});

module.exports = mongoose.model('WorkOrder', WorkOrderSchema);