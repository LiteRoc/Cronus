const mongoose = require('mongoose');

const procedureSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Procedure name
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }], // References to reusable tasks
}, { timestamps: true });

module.exports = mongoose.model('Procedure', procedureSchema);

