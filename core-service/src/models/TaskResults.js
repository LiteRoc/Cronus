const mongoose = require('mongoose');

const taskResultSchema = new mongoose.Schema({
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    procedureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Procedure', required: true },
    result: { type: mongoose.Schema.Types.Mixed, default: null }, // Pass/Fail, number, or comment
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Technician who submitted
    timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('TaskResult', taskResultSchema);