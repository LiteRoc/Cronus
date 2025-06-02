const express = require('express');
const mongoose = require('mongoose');
const Part = require('../models/Part');
const debug = require('debug')('app:partRouter');

const partRouter = express.Router();

// POST: Create a new part
partRouter.post('/', async (req, res) => {
    const { supplierId } = req.body;
    try {

        // Validate supplierId
        if (supplierId && !mongoose.Types.ObjectId.isValid(supplierId)) {
            return res.status(400).json({ error: 'Invalid supplier ID' });
        }

        const part = new Part(req.body);
        await part.save();
        res.status(201).json({ message: 'Part created successfully', part });
    } catch (error) {
        debug('Error creating part:', error);
        if (error.code === 11000) {
            res.status(400).json({ error: 'Part number must be unique' });
        } else {
            res.status(500).json({ error: 'Failed to create part' });
        }
    }
});

// GET: Retrieve all parts
partRouter.get('/', async (req, res) => {
    try {
        const parts = await Part.find().populate('supplierId', 'name contactEmail contactPhone address');
        res.status(200).json(parts);
    } catch (error) {
        debug('Error fetching parts:', error);
        res.status(500).json({ error: 'Failed to fetch parts' });
    }
});

module.exports = partRouter;