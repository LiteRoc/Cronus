const mongoose = require('mongoose');
const { Schema } = mongoose;

const ConsumableSchema = new Schema({
  facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  assetId:    { type: Schema.Types.ObjectId, ref: 'Asset', required: true, index: true },

  name:       { type: String, required: true },
  lotNumber:  { type: String, default: '' },
  quantity:   { type: Number, min: 0, default: 1 },

  // Expiry
  expiresAt:  { type: Date, required: true, index: true },

  // Approval workflow
  replacementApprovedAt:  { type: Date, default: null },
  replacementApprovedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },

  // Optional fields for traceability
  notes:      { type: String, default: '' },

  // Audit
  createdBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt:  { type: Date, default: null },
  deletedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

ConsumableSchema.index({ facilityId: 1, expiresAt: 1 });
ConsumableSchema.index({ assetId: 1, expiresAt: 1 });

module.exports = mongoose.model('Consumable', ConsumableSchema);