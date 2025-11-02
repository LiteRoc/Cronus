// models/Asset.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

/** Subdocument: maintenance schedule (actually used below) */
const MaintenanceScheduleSchema = new Schema({
  frequency: { type: String, enum: ['Yearly', 'Monthly', 'Quarterly', 'Custom'], required: false },
  intervalMonths: { type: Number },
  nextMaintenance: { type: Date },
  lastMaintenance: { type: Date },
  procedure: { type: Schema.Types.ObjectId, ref: 'Procedure' },
}, { _id: false });

// custom, dynamic key-value pairs
/*const attributeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: mongoose.Schema.Types.Mixed,
}, { _id: false });*/

/** Base Asset schema (template‑first + parent/child) */
const AssetSchema = new Schema({
  
  // Identity
  ctrlNumber: { type: String, required: true, trim: true, unique: true, index: true },
  templateId: { type: Schema.Types.ObjectId, ref: 'EquipmentTemplate', default: null },

  manufacturer: { type: String, required: true, trim: true },
  model: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  serialNumber: { type: String, trim: true },
  revisionNumber: { type: String, trim: true },
  status: { type: String, enum: ['Active', 'Inactive', 'Pending', 'Retired'], default: 'Active' },
  notes: { type: String, default: null },
  isArchived: { type: Boolean, default: false },

  // Location
  facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  locationNote: { type: String, trim: true },

  // FDA Extras
  equipmentClass: { type: String, default: '' },
  classificationName: { type: String, default: '' },
  regulationNumber: { type: String, default: '' },
  panel: { type: String, default: '' },
  recordStatus: { type: String, default: '' },
  prescriptionRequired: { type: Boolean },
  otc: { type: Boolean },
  submissionNumber: { type: String, default: '' },
  manufacturerDUNS: { type: String, default: '' },
  gmdnDefinition: { type: String, default: '' },

  // Parent/Child (single parent)
  parentAsset: { type: Schema.Types.ObjectId, ref: 'Asset', default: null },
  relationToParent: {
    type: String,
    enum: ['Monitors', 'Component', 'Accessory', 'Connected', 'Other'],
    default: 'Other'
  },

  // PM
  maintenanceSchedule: { type: MaintenanceScheduleSchema, default: null },

  // Flexible extras (Map-based attributes)
  attributes: { type: Map, of: Schema.Types.Mixed, default: {} },

  // Links
  workOrders: [{ type: Schema.Types.ObjectId, ref: 'WorkOrder' }],

  // In Asset schema (optional on most assets, but used for test equipment)
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },


  // Compliance
  riskLevel: { type: String, enum: ["Non-High Risk", "High Risk"] },
  isHIPAARelevant: { type: Boolean },
  isAlarmed: { type: Boolean },
  isSecuritySensitive: { type: Boolean },
  isAEMExcluded: { type: Boolean },

  // Financial
  purchaseDate: { type: Date },
  purchaseCost: { type: Number },
  budgetValue: { type: Number },
  contractValue: { type: Number },
  manufacturerRecommendedPMFrequency: { type: Number },

  // Attachments
  documents: [{ type: String }],
  images: [{ type: String }],

  duplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EquipmentTemplate',
    default: null
  },

  // Audit
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  // Soft-delete metadata
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

/** Virtual children (inverse of parentAsset) */
AssetSchema.virtual('children', {
  ref: 'Asset',
  localField: '_id',
  foreignField: 'parentAsset',
});

/** Indexes */
AssetSchema.index({ facilityId: 1, departmentId: 1, ctrlNumber: 1 });

// Parent/child lookups (children, lineage, tree)
AssetSchema.index({ parentAsset: 1 });

// Soft‑delete auditing + common lookups
AssetSchema.index({ deletedAt: 1 });

// Extras
AssetSchema.index({ serialNumber: 1 }, { sparse: true });
AssetSchema.index({ templateId: 1 });

/** Guard rails (no self/loop) */
AssetSchema.pre('save', async function (next) {
  if (!this.isModified('parentAsset')) return next();
  if (this.parentAsset && this.parentAsset.equals(this._id)) {
    return next(new Error('An asset cannot be its own parent.'));
  }
  if (this.parentAsset) {
    const Asset = this.constructor;
    let cursor = await Asset.findById(this.parentAsset).select('parentAsset').lean();
    let hops = 0;
    while (cursor?.parentAsset && hops < 20) {
      if (String(cursor.parentAsset) === String(this._id)) {
        return next(new Error('Cyclic relationship detected.'));
      }
      cursor = await Asset.findById(cursor.parentAsset).select('parentAsset').lean();
      hops++;
    }
  }
  next();
});

module.exports = mongoose.model('Asset', AssetSchema, 'assets');