const mongoose = require('mongoose');
// Approval is server-owned on Asset edits. Organization policy publication is separate.
module.exports = new mongoose.Schema({
  expectedLifeYears: { type: Number, required() { return this.ageRuleEnabled !== false; }, validate: value => value == null || Number.isFinite(value) && value > 0 },
  ageRuleEnabled: { type: Boolean, default: true },
  sourceType: { type: String, enum: ['asset_override', 'organization_policy', 'adopted_benchmark'], required: true },
  reference: { type: String, required: true, trim: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EquipmentTemplate' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  approvedAt: { type: Date, required: true },
}, { _id: false });
