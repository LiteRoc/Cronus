const mongoose = require('mongoose');

const { Schema } = mongoose;

const followUpSchema = new Schema({
  facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  description: { type: String, default: '', trim: true, maxlength: 5000 },
  dueAt: { type: Date, required: true },
  status: { type: String, enum: ['open', 'completed', 'cancelled'], default: 'open' },
  priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  contactId: { type: Schema.Types.ObjectId, ref: 'Contact', default: null },
  completedAt: { type: Date, default: null },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, optimisticConcurrency: true });

followUpSchema.pre('validate', function enforceLifecycleInvariants() {
  const hasCompletedAt = Boolean(this.completedAt);
  const hasCompletedBy = Boolean(this.completedBy);
  const hasCancelledAt = Boolean(this.cancelledAt);
  const hasCancelledBy = Boolean(this.cancelledBy);
  const hasArchivedAt = Boolean(this.archivedAt);
  const hasArchivedBy = Boolean(this.archivedBy);

  if (this.status === 'completed' && (!hasCompletedAt || !hasCompletedBy)) {
    this.invalidate('status', 'Completed FollowUps require completedAt and completedBy');
  }
  if (this.status !== 'completed' && (hasCompletedAt || hasCompletedBy)) {
    this.invalidate('status', 'Only completed FollowUps may have completion audit fields');
  }
  if (this.status === 'cancelled' && (!hasCancelledAt || !hasCancelledBy)) {
    this.invalidate('status', 'Cancelled FollowUps require cancelledAt and cancelledBy');
  }
  if (this.status !== 'cancelled' && (hasCancelledAt || hasCancelledBy)) {
    this.invalidate('status', 'Only cancelled FollowUps may have cancellation audit fields');
  }
  if (hasArchivedAt !== hasArchivedBy) {
    this.invalidate('archivedAt', 'Archived FollowUps require archivedAt and archivedBy together');
  }
});

function rejectQueryUpdates() {
  throw new Error('FollowUp mutations must load and save a validated document');
}

followUpSchema.pre('findOneAndUpdate', rejectQueryUpdates);
followUpSchema.pre('findOneAndReplace', rejectQueryUpdates);
followUpSchema.pre('updateOne', rejectQueryUpdates);
followUpSchema.pre('updateMany', rejectQueryUpdates);
followUpSchema.pre('replaceOne', rejectQueryUpdates);
followUpSchema.pre('bulkWrite', rejectQueryUpdates);

followUpSchema.index({ facilityId: 1, archivedAt: 1, dueAt: 1, _id: 1 });
followUpSchema.index({ facilityId: 1, archivedAt: 1, status: 1, dueAt: 1, _id: 1 });
followUpSchema.index({ facilityId: 1, archivedAt: 1, assignedTo: 1, dueAt: 1, _id: 1 });
followUpSchema.index({ facilityId: 1, archivedAt: 1, contactId: 1, dueAt: 1, _id: 1 });

module.exports = mongoose.model('FollowUp', followUpSchema);
