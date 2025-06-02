const express = require('express');
const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const debug = require('debug')('app:supplierRouter');

const supplierRouter = express.Router();

// POST: Create a new supplier
supplierRouter.post('/', async (req, res) => {
    try {
        const supplier = new Supplier(req.body);
        await supplier.save();
        res.status(201).json({ message: 'Supplier created successfully', supplier });
    } catch (error) {
        debug('Error creating supplier:', error);
        res.status(500).json({ error: 'Failed to create supplier' });
    }
});

// GET: Retrieve all suppliers
supplierRouter.get('/', async (req, res) => {
    try {
        const suppliers = await Supplier.find();
        res.status(200).json(suppliers);
    } catch (error) {
        debug('Error fetching suppliers:', error);
        res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
});

module.exports = supplierRouter;
