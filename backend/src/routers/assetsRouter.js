const express = require('express');
const mongoose = require('mongoose');
const debug = require('debug')('app:assetsRouter');
const Asset = require('../models/Asset'); // Import the Asset model
const WorkOrder = require('../models/WorkOrder'); // Import the WorkOrder model
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware'); // Middleware for authentication/authorization
const workOrderRouter = require('./workOrderRouter'); // Work order routes

mongoose.set('strictPopulate', false); // Allow non-strict population

const assetRouter = express.Router();

// GET all assets with optional filtering
assetRouter.get('/', async (req, res) => {
    const { search, manufacturer, model, status, page = 1, limit = 10 } = req.query;

    try {
        const query = {};
        if (search) {
            query.$or = [
                { ctrlNumber: { $regex: search, $options: 'i' } },
                { manufacturer: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
            ];
        }
        if (manufacturer) query.manufacturer = manufacturer;
        if (model) query.model = model;
        if (status) query.status = status;

        // Parse the `page` and `limit` to ensure they are numbers
        const pageNumber = parseInt(page, 10) || 1; // Default to 1 if not provided
        const limitNumber = parseInt(limit, 10) || 10; // Default to 10 if not provided
        const skip = (pageNumber - 1) * limitNumber;

        // Fetch total count and paginated assets
        const totalAssets = await Asset.countDocuments(query);
        const assets = await Asset.find(query)
            .skip(skip)
            .limit(limitNumber)
            .populate({
                path: 'workOrders',
                select: 'description status scheduledDate completionDate workOrderNumber', // Optimize with selected fields
            })
            .lean();

        // Add a fallback for maintenanceSchedule if not set
        const enrichedAssets = assets.map(asset => ({
            ...asset,
            maintenanceSchedule: asset.maintenanceSchedule || { message: 'No schedule defined' },
        }));

        res.status(200).json({
            assets: enrichedAssets,
            totalPages: Math.ceil(totalAssets / limitNumber),
            currentPage: pageNumber,
            totalAssets,
        });
    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET a single asset by ID
assetRouter.get('/:id', async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid asset ID format' });
    }

    try {
        const asset = await Asset.findById(id)
        .populate({
            path: 'workOrders',
            select: 'description status scheduledDate completionDate',
        })
        .populate({
            path: 'maintenanceSchedule.procedure', // Populate the procedure within the maintenanceSchedule
            select: 'name tasks', // Specify fields to return from the procedure
        });

        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        res.status(200).json(asset);
    } catch (error) {
        debug('Error fetching asset:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT: Update an asset by ID
assetRouter.put('/:id', async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid asset ID format' });
    }

    try {
        const updatedAsset = await Asset.findByIdAndUpdate(id, updatedData, { new: true, runValidators: true });
        if (!updatedAsset) return res.status(404).json({ error: 'Asset not found' });

        res.status(200).json({ message: 'Asset updated successfully', asset: updatedAsset });
    } catch (error) {
        debug('Error updating asset:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE: Remove an asset by ID
assetRouter.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid asset ID format' });
    }

    try {
        const deletedAsset = await Asset.findByIdAndDelete(id);
        if (!deletedAsset) return res.status(404).json({ error: 'Asset not found' });

        res.status(200).json({ message: 'Asset deleted successfully' });
    } catch (error) {
        debug('Error deleting asset:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET: Return only test equipment
assetRouter.get('/test-equipment', async (req, res) => {
    try {
        const testEquipment = await Asset.find({ category: 'test' }).lean();
        res.status(200).json(testEquipment);
    } catch (error) {
        debug('Error fetching test equipment:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Nested router for work orders
assetRouter.use('/:assetId/workorders', (req, res, next) => {
    req.assetId = req.params.assetId; // Pass assetId to workOrderRouter
    next();
}, workOrderRouter);

module.exports = assetRouter;
