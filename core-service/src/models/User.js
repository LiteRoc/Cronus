// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'technician', 'customer', 'viewer'], default: 'viewer' },

  facilities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Facility',
  }],
  facilityId: { type: Schema.Types.ObjectId, ref: 'Facility' },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },

  title: { type: String, default: '' },
  phone: { type: String, default: '' },
  isPrimary: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.index({ facilityId: 1, role: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);