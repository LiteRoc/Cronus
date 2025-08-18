const express = require('express');
const Customer = require('../models/Customer');
const customerRouter = express.Router();

// GET all customers
customerRouter.get('/', async (req, res) => {
  try {
    const customers = await Customer.find().lean();
    res.status(200).json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET a single customer
customerRouter.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.status(200).json(customer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// CREATE a new customer
customerRouter.post('/', async (req, res) => {
  try {
    const newCustomer = new Customer(req.body);
    await newCustomer.save();
    res.status(201).json({ message: 'Customer created', customer: newCustomer });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create customer', details: err.message });
  }
});

// UPDATE a customer
customerRouter.put('/:id', async (req, res) => {
  try {
    const updated = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Customer not found' });
    res.status(200).json({ message: 'Customer updated', customer: updated });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update customer', details: err.message });
  }
});

// DELETE a customer
customerRouter.delete('/:id', async (req, res) => {
  try {
    const deleted = await Customer.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Customer not found' });
    res.status(200).json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = customerRouter;