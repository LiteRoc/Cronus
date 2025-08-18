const mongoose = require('mongoose');
const { Schema } = mongoose;

const amendmentSchema = new Schema({
  date: { type: Date, required: true },
  description: String,
  changeType: { type: String, enum: ['add', 'remove', 'update'], required: true },
  assetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
  financialChange: Number, // positive or negative change to contract cost/revenue
}, { _id: false });

const contractSchema = new Schema({
  type: { type: String, enum: ['vendor', 'customer'], required: true },
  name: { type: String, required: true },
  linkedVendor: { type: Schema.Types.ObjectId, ref: 'Vendor' },
  linkedCustomer: { type: Schema.Types.ObjectId, ref: 'Customer' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'expired', 'pending'], default: 'pending' },
  totalValue: { type: Number, required: true }, // annual or term total cost
  coveredAssets: [{ type: Schema.Types.ObjectId, ref: 'Asset' }],
  amendments: [amendmentSchema],
  linkedWorkOrders: [{ type: Schema.Types.ObjectId, ref: 'WorkOrder' }],
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Contract', contractSchema);