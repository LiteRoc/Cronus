const mongoose = require('mongoose');

const procedureSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Procedure name
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }], // References to reusable tasks
    /*taskResults: [
        {
            taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
            result: { type: mongoose.Schema.Types.Mixed, default: null },
            submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional
            timestamp: { type: Date, default: Date.now }, // Record submission time
        },
    ],*/
}, { timestamps: true });

module.exports = mongoose.model('Procedure', procedureSchema);

