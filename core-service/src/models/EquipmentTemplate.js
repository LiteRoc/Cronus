// src/models/EquipmentTemplate.js

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

  isTestEquipment: { type: Boolean, default: false, index: true },

  // expectedLifeYears = template.lifecycleDefaults?.expectedLifeYears ?? template.eolYears
  // eventually we want to migrate all templates to use lifecycleDefaults.expectedLifeYears and deprecate the old eolYears field, but for now we can support both and use whichever is present for better backwards compatibility with existing templates
  eolYears: { type: Number }, // new field for expected life in years (can be used for lifecycle calculations)

  // Optional GUDID fields for better template‑to‑asset matching
  lineItemPricing: { type: Number },

  lifecycleDefaults: {
    expectedLifeYears: { type: Number, min: 0 },
    typicalAnnualMaintenance: { type: Number, min: 0 },
  },

  benchmark: {
    source: { type: String, default: '' }, // ECRI
    reportDate: { type: Date, index: true },

    expectedUsefulLifeYears: { type: Number, min: 0 },

    averageListPrice: { type: Number, min: 0 },
    averageQuotedPrice: { type: Number, min: 0 },

    expectedAnnualMaintenance: { type: Number, min: 0 },
    expectedCapitalCostRatio: { type: Number, min: 0 },

    marketInterest: { type: Number, min: 0 },

    confidence: {
      type: String,
      enum: ['low', 'medium', 'high', ''],
      default: ''
    },

  notes: { type: String, default: '' }
},

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
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verificationSource: { type: String, default: null },
  status: { type: String, default: 'Active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Read compatibility only. New archives use deletedAt/deletedBy and Archived.
  archivedAt: { type: Date },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isArchived: { type: Boolean },
  // No expiry: an uncertain dependent write must continue to block archive.
  templateReferenceReservation: {
    type: new mongoose.Schema({
      token: { type: String, required: true },
      acquiredAt: { type: Date, required: true },
      operation: { type: String, required: true },
      destinationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    }, { _id: false }),
    default: undefined,
    select: false,
  },

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

EquipmentTemplateSchema.pre('init', function (raw) {
  require('../services/templateArchiveState').remember(this, raw);
});

for (const method of ['toJSON', 'toObject']) EquipmentTemplateSchema.set(method, {
  transform(_doc, result) {
    delete result.templateReferenceReservation;
    return result;
  },
});

// Fast filtering and distincts
EquipmentTemplateSchema.index(
  { manufacturer: 1, model: 1 },
  { unique: true, partialFilterExpression: { di: { $exists: false } } }
);

// GUDID mapping & de‑duplication
//EquipmentTemplateSchema.index({ di: 1 }, { unique: true, sparse: true });

// Optional: product code lookups / admin searches
EquipmentTemplateSchema.index({ fdaProductCode: 1 });

module.exports = mongoose.model('EquipmentTemplate', EquipmentTemplateSchema);
