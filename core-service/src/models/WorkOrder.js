// src/models/WorkOrder.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

const Counter = require('./Counter');

const TimeLogSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timeSpent: { type: Number, min: 1, required: true }, // minutes
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },

  workDate: { type: String, default: null },
  pricing: { type: Schema.Types.Mixed, default: null },
  // Historical cost snapshot
  laborRate: { type: Number, min: 0, default: null }, // $/hour
  laborCost: { type: Number, min: 0, default: null }, // computed: minutes/60 * rate
});

const TravelLogSchema = new Schema({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  travelTime: { type: Number, min: 1, required: true }, // minutes
  workDate: { type: String, default: null },
  travelCost: { type: Number, default: null },
  pricing: { type: Schema.Types.Mixed, default: null },
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

  _id: { type: Schema.Types.ObjectId, default: undefined },
  pricing: { type: Schema.Types.Mixed, default: null },
  // Historical cost snapshot fields
  unitCost: { type: Number, min: 0, default: null },
  extendedCost: { type: Number, min: 0, default: null },

  usedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  usedAt:   { type: Date, default: Date.now },
}, { _id: false });

const VendorServiceSchema = new Schema({
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', default: null },
  vendorName: { type: String, default: '' },
  vendorWorkOrderNumber: { type: String, default: '' },

  laborHours: { type: Number, min: 0, default: null },
  travelHours: { type: Number, min: 0, default: null },

  laborCost: { type: Number, min: 0, default: null },
  travelCost: { type: Number, min: 0, default: null },
  partsCost: { type: Number, min: 0, default: null },
  shippingCost: { type: Number, min: 0, default: null },
  totalCost: { type: Number, min: 0, default: null },

  invoiceNumber: { type: String, default: '' },
  poNumber: { type: String, default: '' },
  sourceDocument: { type: String, default: '' },
  pricing: { type: Schema.Types.Mixed, default: null },
  attribution: { type: Schema.Types.Mixed, default: null },
  breakdownComplete: { type: Boolean, default: false },
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

  // vendor service details (if this WO was created from a vendor report or includes vendor work)
  vendorService: { type: VendorServiceSchema, default: null },

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

  // Server-owned reproducible cache; legacy raw values remain readable through
  // the canonical adapter without being promoted to authoritative economics.
  costs: { type: Schema.Types.Mixed, default: undefined },
  economics: { type: Schema.Types.Mixed, default: undefined },
  importIdentity: { type: String, default: undefined },
  importProvenance: { type: Schema.Types.Mixed, default: undefined },
  costRepairHistory: { type: [Schema.Types.Mixed], default: undefined },

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
}, { timestamps: true, minimize: false });

// indexes that matter
WorkOrderSchema.index({ facilityId: 1, status: 1, dueDate: 1 });
WorkOrderSchema.index({ ticketId: 1 }); // for quick joins & lookups
//WorkOrderSchema.index({ workOrderNumber: 1 }, { unique: true, sparse: true }); // if using sequential numbers
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
    { new: true, upsert: true, session: this.$session() }
  );
  this.workOrderNumber = c.seq;
  next();
});

WorkOrderSchema.add({
  partsUsed: [PartUsageSchema],
});

const economicContext = require('../services/workOrderCosts/context');
const protectedRoots = ['timeLogs','travelLogs','partsUsed','vendorService','costs','economics','importIdentity','importProvenance','costRepairHistory'];
function protectEconomicChanges() {
  if (!economicContext.authorized() && !this.isNew && protectedRoots.some(k => this.isModified(k))) {
    throw new Error('Economic changes require the canonical Work Order service');
  }
  // Unreviewed model callers may create operational legacy records, but cannot
  // certify them. Mounted creators and sanctioned imports use the service.
  if (!economicContext.authorized() && this.isNew && (this.economics || this.costs)) {
    throw new Error('Canonical aggregates cannot be supplied by callers');
  }
}
WorkOrderSchema.pre('validate', protectEconomicChanges);
WorkOrderSchema.pre('save', protectEconomicChanges);
function economicUpdate(update) {
  if (Array.isArray(update)) return true;
  for (const [key, value] of Object.entries(update || {})) {
    if (key.startsWith('$')) {
      if (economicUpdate(value)) return true;
      if (key === '$rename' && Object.values(value).some(v => protectedRoots.includes(String(v).split('.')[0]))) return true;
    } else if (protectedRoots.includes(key.split('.')[0])) return true;
  }
  return false;
}
for (const operation of ['updateOne','updateMany','findOneAndUpdate','replaceOne','findOneAndReplace']) {
  WorkOrderSchema.pre(operation, function () {
    if (!economicContext.authorized() && (operation.includes('Replace') || operation === 'replaceOne' || economicUpdate(this.getUpdate())))
      throw new Error('Economic changes require the canonical Work Order service');
  });
}
WorkOrderSchema.pre('insertMany', function (next) { next(new Error('Use the sanctioned Work Order import service')); });
WorkOrderSchema.pre('bulkWrite', function (next) { next(new Error('Use the sanctioned Work Order service')); });
WorkOrderSchema.index({ facilityId: 1, importIdentity: 1 }, { unique: true, partialFilterExpression: { importIdentity: { $type: 'string' } } });
module.exports = mongoose.model('WorkOrder', WorkOrderSchema);
