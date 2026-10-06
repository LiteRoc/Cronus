// models/Organization.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const organizationSchema = new Schema({
  name: { type: String, required: true, unique: true },
  type: { type: String, default: 'Health System' },
  notes: { type: String, default: '' },
  // Per-Template approved evidence; no publication API is introduced by #20.
  lifecyclePolicies: { type: [require('./lifecyclePolicySchema')], default: undefined },
}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);