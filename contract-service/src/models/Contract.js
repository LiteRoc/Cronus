// src/models/Contract.js
import e from 'express';
import mongoose from 'mongoose';

const { Schema } = mongoose;

/** -----------------------------
 * Status enums
 * ------------------------------*/
export const CONTRACT_STATUSES = [
  'draft',
  'in_review',
  'submitted',
  'approved',
  'active',
  'declined',
  'expired',
  'terminated',
  'voided',
  'superseded',
];

export const AMENDMENT_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'applied',     // “in force”
  'declined',
  'voided',
  'superseded',
];

/** -----------------------------
 * Allowed status transitions
 * ------------------------------*/
const CONTRACT_TRANSITIONS = {
  draft:       ['in_review', 'submitted', 'voided'],
  in_review:   ['draft', 'submitted', 'voided'],
  submitted:   ['approved', 'declined', 'voided'],
  approved:    ['active', 'voided'],
  active:      ['terminated', 'superseded'], // 'expired' should be automation-only
  declined:    ['draft', 'voided'],
  expired:     [],
  terminated:  [],
  voided:      [],
  superseded:  [],
};

const AMENDMENT_TRANSITIONS = {
  draft:      ['submitted', 'voided'],
  submitted:  ['approved', 'declined', 'voided'],
  approved:   ['applied', 'voided'],
  applied:    ['superseded'],
  declined:   ['draft', 'voided'],
  voided:     [],
  superseded: [],
};

function assertTransition(current, next, transitions, label = 'status') {
  const allowed = transitions[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Illegal ${label} transition: ${current} → ${next}`);
  }
}

const AMENDMENT_BUSINESS_FIELDS = ["date", "description", "changeType", "items", "totalDelta"];

function amendmentBusinessSnapshot(amendment) {
  return Object.fromEntries(
    AMENDMENT_BUSINESS_FIELDS.map((field) => [field, amendment?.[field] ?? null])
  );
}

function comparable(value) {
  return JSON.stringify(value, (_key, item) =>
    item instanceof mongoose.Types.ObjectId ? item.toString() : item
  );
}

/** -----------------------------
 * Sub-schemas
 * ------------------------------*/

const amendmentItemSchema = new Schema({
  assetId: { type: Schema.Types.ObjectId, required: true },
  deltaValue: { type: Number, default: 0 },
  note: String,

  // Coverage: risk encoding
  coverageCode: {
    type: String,
    enum: ['FSC', 'PMWP', 'PMO', 'LBR', 'PARTS', 'HYB'],
    default: 'FSC',
  },

  serviceProviderType: { type: String, enum: ['vendor', 'internal'], default: 'internal' },
  serviceProviderId: { type: Schema.Types.ObjectId, required: false }, // references either Vendor or internal Deptartment
}, { _id: false });

const amendmentSchema = new Schema({
  // lifecycle
  amendmentNumber: { type: String }, // e.g., "2026023-01.1"
  status: { type: String, enum: AMENDMENT_STATUSES, default: 'draft' },

  // metadata/audit
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId },
  submittedAt: { type: Date },
  submittedBy: { type: Schema.Types.ObjectId },
  approvedAt: { type: Date },
  approvedBy: { type: Schema.Types.ObjectId },
  appliedAt: { type: Date },
  appliedBy: { type: Schema.Types.ObjectId },
  declinedAt: { type: Date },
  declinedBy: { type: Schema.Types.ObjectId },
  declineReason: { type: String },
  voidedAt: { type: Date },
  voidedBy: { type: Schema.Types.ObjectId },

  // business fields
  date: { type: Date, required: true }, // effective date
  description: String,
  changeType: { type: String, enum: ['add', 'remove', 'update'], required: true },
  items: { type: [amendmentItemSchema], default: [] },
  totalDelta: { type: Number, default: 0 },
  setsBase: { type: Boolean, default: false }, // legacy metadata; value engine does not replace the base
  excludeFromFinancials: { type: Boolean, default: false }
}, { _id: true });

const vendorLinkSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, required: true }, // from core vendors or your vendor collection
    nameSnapshot: { type: String }, // optional denormalized vendor name

    // commercial terms
    coverageType: {
      type: String,
      enum: ["full", "pm-only", "parts-only", "labor-only", "t&m", "other"],
      default: "full",
    },

    startDate: { type: Date },
    endDate: { type: Date },

    // what you pay the vendor
    annualCost: { type: Number, default: 0 }, // or monthlyCost—pick one
    notes: { type: String },

    // the *subset* of assets the vendor is responsible for
    coveredAssetIds: [{ type: Schema.Types.ObjectId, default: [] }],

    // optional: track invoices (nice later, but cheap to add now)
    invoices: {
      type: [
        new Schema(
          {
            invoiceNumber: String,
            amount: Number,
            date: Date,
            status: { type: String, enum: ["open", "paid", "void"], default: "open" },
            notes: String,
          },
          { _id: true }
        ),
      ],
      default: [],
    },
  }, { _id: true });

/** -----------------------------
 * Contract schema
 * ------------------------------*/
const contractSchema = new Schema({
  contractNumber: { type: String, required: true, unique: true }, // e.g., "2026023-01"
  type: { type: String, enum: ['vendor', 'customer'], required: true },
  name: { type: String, required: true },
  linkedVendor: { type: Schema.Types.ObjectId },
  vendorLinks: { type: [vendorLinkSchema], default: [] },
  linkedCustomer: { type: Schema.Types.ObjectId },
  facilityId: { type: Schema.Types.ObjectId },

  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  status: { type: String, enum: CONTRACT_STATUSES, default: 'draft' },

  // audit
  createdBy: { type: Schema.Types.ObjectId },
  activatedAt: { type: Date },
  activatedBy: { type: Schema.Types.ObjectId },
  submittedAt: { type: Date },
  submittedBy: { type: Schema.Types.ObjectId },
  approvedAt: { type: Date },
  approvedBy: { type: Schema.Types.ObjectId },
  declinedAt: { type: Date },
  declinedBy: { type: Schema.Types.ObjectId },
  declineReason: { type: String },
  terminatedAt: { type: Date },
  terminatedBy: { type: Schema.Types.ObjectId },
  terminationReason: { type: String },
  expiredAt: { type: Date },
  expiredBy: { type: Schema.Types.ObjectId },
  
  // business fields

  totalValue: { type: Number, required: true }, // immutable base annual value
  coveredAssets: [{ type: Schema.Types.ObjectId }],
  amendments: { type: [amendmentSchema], default: [] },
  amendmentSeq: { type: Number, default: 0 }, // for generating amendment IDs
  linkedWorkOrders: [{ type: Schema.Types.ObjectId }],
  notes: String,
}, { timestamps: true, collection: 'contracts' });



// INDEXES
contractSchema.index({ facilityId: 1, status: 1, startDate: 1, endDate: 1 });
contractSchema.index({ status: 1, "amendments.status": 1, "amendments.date": 1 });
contractSchema.index({ facilityId: 1, coveredAssets: 1, status: 1 });
contractSchema.index({ facilityId: 1, "amendments.items.assetId": 1 });

/** -----------------------------
 * Guardrails
 * ------------------------------*/

// Track original contract status so we can validate transitions on save
contractSchema.pre('init', function(doc) {
  this.$locals._originalStatus = doc.status;
  this.$locals._originalAmendments = new Map(
    (doc.amendments || []).map((amendment) => [String(amendment._id), {
      status: amendment.status || "draft",
      business: amendmentBusinessSnapshot(amendment),
    }])
  );
});

// Validate contract status transition on save
contractSchema.pre('save', function(next) {
  const bypass = this.$locals?._systemBypassValidation === true;
  try {

    // On create, no transition validation needed
    if (this.isNew) {
      return next();
    }

    // Validate contract status transitions
    if (this.isModified('status')) {
      const prev = this.$locals._originalStatus ?? 'draft';
      const nextStatus = this.status;

      // allow first-time creation to set default without blocking
      if (!bypass && prev !== nextStatus) {
        assertTransition(prev, nextStatus, CONTRACT_TRANSITIONS, 'contract status');
      }
    }

    // Lock core contract fields once submitted/approved/active/etc.
    const lockedContractStatuses = ['submitted', 'approved', 'active', 'expired', 'terminated', 'superseded', 'voided'];
    if (lockedContractStatuses.includes(this.status)) {
      // Allow changes to these fields even when locked:
      const allowedWhenLocked = new Set([
        'status',
        'vendorLinks',
        'activatedAt','activatedBy',
        'submittedAt','submittedBy',
        'approvedAt','approvedBy',
        'declinedAt','declinedBy','declineReason',
        'terminatedAt','terminatedBy','terminationReason',
        'expiredAt','expiredBy',
        'amendments',
        'coveredAssets',
        'linkedWorkOrders',
        'notes',
        'totalValue',
        'amendmentSeq',
        'updatedAt',
      ]);

      // If anything else changed, block it.
      const modified = this.modifiedPaths();
      const illegal = modified.filter(p => !allowedWhenLocked.has(p.split('.')[0]));
      if (illegal.length > 0) {
        throw new Error(`Contract is locked in status "${this.status}". Illegal modification(s): ${illegal.join(', ')}`);
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Amendment transition validation and business-field lock
contractSchema.pre("save", function(next) {
  try {
    if (this.isModified("amendments")) {
      for (const amendment of this.amendments) {
        const original = this.$locals._originalAmendments?.get(String(amendment._id));
        if (!original) continue;

        if (original.status !== amendment.status) {
          assertTransition(
            original.status,
            amendment.status,
            AMENDMENT_TRANSITIONS,
            "amendment status"
          );
        }

        if (
          original.status !== "draft" &&
          comparable(original.business) !==
            comparable(amendmentBusinessSnapshot(amendment.toObject()))
        ) {
          throw new Error(
            `Amendment ${amendment.amendmentNumber || amendment._id} business fields are locked after submission`
          );
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

contractSchema.post("save", function(doc) {
  doc.$locals._originalStatus = doc.status;
  doc.$locals._originalAmendments = new Map(
    (doc.amendments || []).map((amendment) => [String(amendment._id), {
      status: amendment.status || "draft",
      business: amendmentBusinessSnapshot(amendment.toObject()),
    }])
  );
});

export default mongoose.model('Contract', contractSchema);

// Export maps for your service/controller layer
export { CONTRACT_TRANSITIONS, AMENDMENT_TRANSITIONS, assertTransition };