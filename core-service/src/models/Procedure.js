const mongoose = require('mongoose');
const { Schema } = mongoose;

const procedureSchema = new Schema({
    name: { type: String, required: true }, // Procedure name
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }], // References to reusable tasks

    status: { type: String, enum: ['Active', 'Inactive', 'Pending', 'Retired'], default: 'Active' },
    
    // Audit
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        
    // Soft-delete metadata
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Procedure', procedureSchema);

