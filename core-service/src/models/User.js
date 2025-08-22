// models/User.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'technician', 'customer', 'viewer'], default: 'viewer' },

  facilityId: { type: Schema.Types.ObjectId, ref: 'Facility' },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },

  title: { type: String, default: '' },
  phone: { type: String, default: '' },
  isPrimary: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.index({ facilityId: 1, role: 1 });

userSchema.methods.comparePassword = async function (candidatePassword) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);