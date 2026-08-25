const mongoose = require('mongoose');

const { Schema } = mongoose;

const contactSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  primaryFacilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
  facilityIds: {
    type: [{ type: Schema.Types.ObjectId, ref: 'Facility', required: true }],
    required: true,
    validate: {
      validator(value) {
        if (!Array.isArray(value) || value.length === 0 || !this.primaryFacilityId) return false;
        return value.some((facilityId) => facilityId.equals(this.primaryFacilityId));
      },
      message: 'facilityIds must include primaryFacilityId',
    },
  },

  firstName: { type: String, required: true, trim: true, maxlength: 120 },
  lastName: { type: String, required: true, trim: true, maxlength: 120 },
  title: { type: String, default: '', trim: true, maxlength: 200 },
  functionalDescription: { type: String, default: '', trim: true, maxlength: 500 },
  email: { type: String, default: '', trim: true, maxlength: 320 },
  phone: { type: String, default: '', trim: true, maxlength: 80 },
  notes: { type: String, default: '', trim: true, maxlength: 5000 },
  status: { type: String, enum: ['active', 'inactive', 'archived'], default: 'active' },

  normalizedEmail: { type: String, default: '', select: false },
  normalizedName: { type: String, default: '', select: false },
  normalizedPhone: { type: String, default: '', select: false },

  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  toJSON: {
    transform(_document, result) {
      delete result.normalizedEmail;
      delete result.normalizedName;
      delete result.normalizedPhone;
      return result;
    },
  },
});

contactSchema.pre('validate', function enforceArchiveInvariants() {
  const isArchived = this.status === 'archived';
  const hasArchivedAt = Boolean(this.archivedAt);
  const hasArchivedBy = Boolean(this.archivedBy);

  if (isArchived && (!hasArchivedAt || !hasArchivedBy)) {
    this.invalidate('status', 'Archived Contacts require archivedAt and archivedBy');
  }
  if (!isArchived && (hasArchivedAt || hasArchivedBy)) {
    this.invalidate('status', 'Non-archived Contacts cannot have archive audit fields');
  }
});

contactSchema.index({ facilityIds: 1, archivedAt: 1, lastName: 1, firstName: 1, _id: 1 });
contactSchema.index(
  { organizationId: 1, normalizedEmail: 1 },
  { partialFilterExpression: { archivedAt: null } },
);
contactSchema.index(
  { organizationId: 1, normalizedName: 1 },
  { partialFilterExpression: { archivedAt: null } },
);
contactSchema.index(
  { organizationId: 1, normalizedPhone: 1 },
  { partialFilterExpression: { archivedAt: null } },
);

module.exports = mongoose.model('Contact', contactSchema);
