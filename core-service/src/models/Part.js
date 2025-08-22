const mongoose = require('mongoose');
const { Schema } = mongoose;

const partSchema = new Schema({
    partNumber: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    quantityOnHand: { type: Number, required: true },
    location: { type: String }, // e.g., warehouse or storage area
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' }, // Reference to Supplier

    status: { type: String, enum: ['Active', 'Inactive', 'Pending', 'Retired'], default: 'Active' },
    
    // Audit
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        
    // Soft-delete metadata
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Part', partSchema);
