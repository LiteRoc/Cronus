const mongoose = require('mongoose');

const EquipmentTemplateSchema = new mongoose.Schema({
  manufacturer: { type: String, index: true, required: true, trim: true },
  model: { type: String, index: true, required: true, trim: true },
  description: { type: String, default: '' },

  // TruAsset-style flags & metadata
  equipmentClass: { type: String, default: '' }, // e.g., Class II
  alarm: { type: Boolean, default: false },
  hipaa: { type: Boolean, default: false },
  autoAddPmProcedure: { type: Boolean, default: true },
  requirePmPlan: { type: Boolean, default: false },
  excludeFromLifecycle: { type: Boolean, default: false },
  excludeFromAEM: { type: Boolean, default: false },

  // new field (months).
  manufacturerRecommendedPMFrequency: { type: Number },

  eolYears: { type: Number },
  lineItemPricing: { type: Number },

  // FDA / GUDID (optional but ideal when DI is known)
  di: { type: String, unique: true, sparse: true, trim: true },
  fdaProductCode: { type: String, default: '' },
  gmdnTerm: { type: String, default: '' },
  gmdnDefinition: { type: String, default: '' },
  brandName: { type: String, default: '' },
  catalogNumber: { type: String, default: '' },
  versionOrModel: { type: String, default: '' },
  mrSafetyStatus: { type: String, default: '' },
  issuingAgency: { type: String, default: '' }, // GS1/HIBCC/ICCBBA
  verified: { type: Boolean, default: false },
  status: { type: String, default: 'Active' },

  // Extra fields
  classificationName: { type: String, default: '' },
  regulationNumber: { type: String, default: '' },
  panel: { type: String, default: '' },
  recordStatus: { type: String, default: '' },
  prescriptionRequired: { type: Boolean },
  otc: { type: Boolean },
  submissionNumber: { type: String, default: '' },
  manufacturerDUNS: { type: String, default: '' },

  // Optional kind/subType to reuse for sensors
  kind: { type: String, default: 'GenericAsset' },
  subType: { type: String, default: '' },
  duplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EquipmentTemplate',
    default: null
  }

}, { timestamps: true });

EquipmentTemplateSchema.index(
  { manufacturer: 1, model: 1 },
  { unique: true, partialFilterExpression: { di: { $exists: false } } }
);

module.exports = mongoose.model('EquipmentTemplate', EquipmentTemplateSchema);