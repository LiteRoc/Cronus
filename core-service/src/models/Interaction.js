const mongoose = require('mongoose');

const { Schema } = mongoose;

const interactionSchema = new Schema({
  facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
  type: { type: String, enum: ['meeting', 'call', 'email', 'site_visit', 'note'], required: true },
  occurredAt: { type: Date, required: true },
  summary: { type: String, required: true, trim: true, maxlength: 240 },
  body: { type: String, default: '', trim: true, maxlength: 10000 },
  direction: { type: String, enum: ['inbound', 'outbound', 'internal'], required: true },
  visibility: {
    type: String, enum: ['operational', 'restricted'], default: 'operational', required: true,
  },
  contactIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Contact' }], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, optimisticConcurrency: true });

interactionSchema.pre('validate', function enforceArchiveInvariants() {
  if (Boolean(this.archivedAt) !== Boolean(this.archivedBy)) {
    this.invalidate('archivedAt', 'Archived Interactions require archivedAt and archivedBy together');
  }
});

function rejectQueryUpdates() {
  throw new Error('Interaction mutations must load and save a validated document');
}

interactionSchema.pre('findOneAndUpdate', rejectQueryUpdates);
interactionSchema.pre('findOneAndReplace', rejectQueryUpdates);
interactionSchema.pre('updateOne', rejectQueryUpdates);
interactionSchema.pre('updateMany', rejectQueryUpdates);
interactionSchema.pre('replaceOne', rejectQueryUpdates);
interactionSchema.pre('bulkWrite', rejectQueryUpdates);

interactionSchema.index({ facilityId: 1, archivedAt: 1, occurredAt: -1, _id: -1 });
interactionSchema.index({ facilityId: 1, archivedAt: 1, visibility: 1, occurredAt: -1, _id: -1 });
interactionSchema.index({ facilityId: 1, archivedAt: 1, contactIds: 1, occurredAt: -1, _id: -1 });

module.exports = mongoose.model('Interaction', interactionSchema);
