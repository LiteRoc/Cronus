const mongoose = require('mongoose');
const { Schema } = mongoose;

const TimeLogSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timeSpent: { type: Number, min: 1, required: true }, // minutes
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const TravelLogSchema = new Schema({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  travelTime: { type: Number, min: 1, required: true }, // minutes
  note:       { type: String, default: '' },
  createdAt:  { type: Date, default: Date.now },
}, { _id: false });

const TaskResultSchema = new mongoose.Schema({
  taskId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  label:         { type: String },                 // denormalized display label
  type:          { type: String, enum: ['passfail', 'measure'], required: true },
  value:         { type: mongoose.Schema.Types.Mixed, default: null }, // boolean/number/string
  unitOfMeasure: { type: String, default: null },
  passed:        { type: Boolean, default: null }, // for pass/fail tasks
  comment:       { type: String, default: '' },

  // who/when captured
  submittedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedAt:   { type: Date, default: null },
}, { _id: false });

const PartUsageSchema = new mongoose.Schema({
  partId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Part', required: true },
  quantity: { type: Number, min: 1, required: true },
  note:     { type: String, default: '' },

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

  // NEW: soft link back to the ticket that originated this WO (if any)
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },

  // procedure: attach a procedure and store taskResults under it
  procedure: {
    _id:         { type: Schema.Types.ObjectId, ref: 'Procedure' },
    name:        { type: String }, // denormalize for fast display
    taskResults: [TaskResultSchema],
  },

  // logs
  timeLogs:   [TimeLogSchema],
  travelLogs: [TravelLogSchema],

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
WorkOrderSchema.index({ customerId: 1, requestDate: -1 });
WorkOrderSchema.index({ customerId: 1, 'timeLogs.userId': 1, status: 1 });
WorkOrderSchema.index({ ticketId: 1 }); // for quick joins & lookups

WorkOrderSchema.pre('save', async function (next) {
  if (!this.isNew || this.workOrderNumber) return next();

  // Per-customer sequence (recommended)
  const counterId = `wo:${this.customerId.toString()}`;
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

module.exports = mongoose.model('WorkOrder', WorkOrderSchema);