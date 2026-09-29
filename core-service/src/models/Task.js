const mongoose = require('mongoose');
const { Schema } = mongoose;
const measurements = require('../services/procedureMeasurements');

const taskSchema = new Schema({
    description: { type: String, required: true }, // Task description
    type: { type: String, enum: ['pass/fail', 'measurement', 'comment'], required: true }, // Task type
    minValue: { type: Number }, // For Measurement type
    maxValue: { type: Number }, // For Measurement type
    unit: { type: String },
    customUnitLabel: { type: String },
    requiredMeasurement: { type: Boolean },
    status: { type: String, enum: ['Active', 'Inactive', 'Pending', 'Retired'], default: 'Active' },

    // Audit
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // Soft-delete metadata
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Validate new/revised definitions, while historical reads retain their labels.
taskSchema.pre('validate', function () {
    if (this.type === 'measurement') measurements.snapshot(this);
});

module.exports = mongoose.model('Task', taskSchema);
