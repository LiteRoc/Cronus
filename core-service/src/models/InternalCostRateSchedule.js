const mongoose = require('mongoose');
const context = require('../services/workOrderCosts/context');
const schema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    ref: 'Organization'
  },
  purpose: {
    type: String,
    enum: ['internal_labor_cost'],
    required: true
  },
  currency: {
    type: String,
    enum: ['USD'],
    required: true
  },
  revision: {
    type: Number,
    required: true
  },
  publishedRevisions: {
    type: [mongoose.Schema.Types.Mixed],
    required: true
  }
}, {
  minimize: false
});
for (const op of ['save', 'updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) schema.pre(op, function () {
  if (!context.authorized()) throw new Error('Rate history must be published through the governed service');
});
schema.pre('insertMany', function (next) {
  next(new Error('Use governed rate publication'));
});
schema.pre('bulkWrite', function (next) {
  next(new Error('Use governed rate publication'));
});
module.exports = mongoose.model('InternalCostRateSchedule', schema);
