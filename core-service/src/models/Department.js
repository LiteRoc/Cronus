// models/Department.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const departmentSchema = new Schema({
  facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
  name: { type: String, required: true },
  code: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

departmentSchema.index({ facilityId: 1, name: 1 });

module.exports = mongoose.model('Department', departmentSchema);