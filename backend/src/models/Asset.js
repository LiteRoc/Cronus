const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    ctrlNumber: { type: String, required: true },  // Required field
    manufacturer: { type: String, required: true },
    model: { type: String, required: true },
    serialNumber: { type: String, required: true },
    notes: { type: String, default: null },       // Optional field
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }, // New field
    category: { type: String, enum: ['Biomed', 'test'], default: 'Biomed' }, // For now, will be used to distinguish test equipment
    workOrders: [{type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' }],
    maintenanceSchedule: {
        type: {
            frequency: { type: String, enum: ['Yearly', 'Monthly', 'Quarterly'], required: true }, // Frequency type
            nextMaintenance: { type: Date, required: false }, // Date of next maintenance
            lastMaintenance: { type: Date, required: false }, // Date of last maintenance
            procedure: { type: mongoose.Schema.Types.ObjectId, ref: 'Procedure', required: true }
        },
        default: null
    }
}, { timestamps: true }); // Adds createdAt and updatedAt fields

const Asset = mongoose.model('Asset', assetSchema, 'assets');

module.exports = mongoose.model('Asset', assetSchema); // Ensure the model is exported
