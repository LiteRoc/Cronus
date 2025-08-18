const mongoose = require('mongoose');

const partSchema = new mongoose.Schema({
    partNumber: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    quantityOnHand: { type: Number, required: true },
    location: { type: String }, // e.g., warehouse or storage area
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' } // Reference to Supplier
}, { timestamps: true });

module.exports = mongoose.model('Part', partSchema);
