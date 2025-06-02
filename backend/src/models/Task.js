const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    description: { type: String, required: true }, // Task description
    type: { type: String, enum: ['Pass/Fail', 'Measurement', 'Comment'], required: true }, // Task type
    minValue: { type: Number }, // For Measurement type
    maxValue: { type: Number }, // For Measurement type
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
