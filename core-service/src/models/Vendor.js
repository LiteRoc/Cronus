const mongoose = require('mongoose');
const { Schema } = mongoose;

const vendorSchema = new Schema({
  name: { type: String, required: true },
  contactInfo: {
    email: String,
    phone: String,
    address: String,
  },
  tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);