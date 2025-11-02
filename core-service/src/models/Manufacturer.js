// models/Manufacturer.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ManufacturerSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    contactName: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    website: { type: String },

    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },

    // Optional audit fields
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Manufacturer', ManufacturerSchema);