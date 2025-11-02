const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    contactName: { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },
    address: { type: String }, // Optional
    website: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);
