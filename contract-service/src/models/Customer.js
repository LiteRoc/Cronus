const mongoose = require('mongoose');
const { Schema } = mongoose;

const customerSchema = new Schema({
  name: { type: String, required: true },
  department: String, // optional – e.g., Radiology, Surgery, Facilities
  contactPerson: {
    name: String,
    email: String,
    phone: String
  },
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    zip: String
  },
  billingCode: String, // optional internal reference
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);