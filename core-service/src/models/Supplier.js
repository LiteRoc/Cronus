const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    contactEmail: { type: String },
    contactPhone: { type: String },
    address: { type: String }, // Optional
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);
