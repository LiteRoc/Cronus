const mongoose = require('mongoose');
const { Schema } = mongoose;

const vendorSchema = new Schema({
  name: { type: String, required: true },
  category: {
    type: String,
    enum: [
      "OEM",
      "ISO",
      "Distributor",
      "Consulting",
      "Rental",
      "Other"
    ]
  },
  contactInfo: {
    primaryContact: String,
    email: String,
    phone: String,
    address: String,
    website: String
  },
  services: [String],
  territories: [String],
  preferredVendor: {
    type: Boolean,
    default: false
  },
  notes: String,
  archivedAt: { type: Date, default: null },
  archivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  tenantId: { type: Schema.Types.ObjectId, required: true, index: true }, // organization Id
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);