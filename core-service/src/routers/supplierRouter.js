const express = require('express');
const Supplier = require('../models/Supplier');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const supplierRouter = express.Router();
const createFields = ['name', 'contactName', 'contactEmail', 'contactPhone', 'address', 'website', 'status'];

// Handle errors from the application's JSON parser within the Supplier mount.
// Never return parser details or the rejected request body.
function supplierJsonErrorHandler(error, _req, res, next) {
    if (error?.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }
    return next(error);
}

// Suppliers are shared internal reference data, without Facility/tenant ownership.
supplierRouter.use(authenticateToken, authorizeRoles('admin', 'technician'));

// POST: Create a new supplier
supplierRouter.post('/', authorizeRoles('admin'), async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Invalid supplier body' });
    }
    const input = {};
    for (const field of createFields) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) input[field] = req.body[field];
    }
    try {
        const supplier = new Supplier(input);
        await supplier.save();
        return res.status(201).json({ message: 'Supplier created successfully', supplier });
    } catch (error) {
        if (error?.name === 'ValidationError') {
            return res.status(400).json({ error: 'Invalid supplier data' });
        }
        if (error?.code === 11000 && error.keyPattern?.name) {
            return res.status(409).json({ error: 'Supplier name already exists' });
        }
        return res.status(500).json({ error: 'Failed to create supplier' });
    }
});

// GET: Retrieve all suppliers
supplierRouter.get('/', async (req, res) => {
    try {
        // Explicit inclusion also excludes undeclared fields in legacy stored records.
        const suppliers = await Supplier.find({}, '_id __v name contactName contactEmail contactPhone address website status createdAt updatedAt');
        return res.status(200).json(suppliers);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
});

supplierRouter.supplierJsonErrorHandler = supplierJsonErrorHandler;
module.exports = supplierRouter;
