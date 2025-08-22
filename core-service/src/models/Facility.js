// models/Facility.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const facilitySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true },
  code: { type: String, unique: true, sparse: true },
  phone: { type: String, default: '' },
  timezone: { type: String, default: 'America/New_York' },
  address: {
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
  },
  notes: { type: String, default: '' },
}, { timestamps: true });

facilitySchema.index({ organizationId: 1, name: 1 });

module.exports = mongoose.model('Facility', facilitySchema);