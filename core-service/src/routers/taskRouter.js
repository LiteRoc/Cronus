const express = require('express');
const Task = require('../models/Task');
const { default: mongoose } = require('mongoose');
const { error } = require('pdf-lib');
const debug = require('debug')('app:taskRouter');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');

const taskRouter = express.Router();

// GET: Fetch Tasks
taskRouter.get('/', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {

    try {
        const tasks = await Task.find();
        res.status(200).json(tasks);
    } catch (error) {
        debug('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// POST: Create a Task
taskRouter.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {

    try {
        const task = new Task({
            ...req.body,
            createdBy: req.user.id,
            updatedBy: req.user.id,
    });
        await task.save();
        res.status(201).json({ message: 'Task created successfully', task });
    } catch (error) {
        debug('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// PUT: Update a task by ID
taskRouter.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) { return res.status(400).json({ error: 'Invalid Task ID format' })};

    try {
        const updated = await Task.findByIdAndUpdate(id);
        if (!update) return res.status(404).json({ error: 'Task not fourd' });

        res.status(200).json({ message: 'Task updated successfully' });
    } catch (error) {
        debug('Error updating TaskL', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH: SOFT DELETE / Remove a task by ID
taskRouter.patch('/:id/achive', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const { id } = req.params;

    try {
        const deleted = await Task.findByIdAndUpdate(
            { _id: id },
            { 
                $set: { 
                deletedAt: new Date(), 
                deletedBy: req.user.id, 
                status: 'Archived' 
                } 
            },
            { new: true } // return the updated doc
        );

        if (!deleted) return res.status(404).json({ error: 'Task not found' });

        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        debug('Error deleting task:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = taskRouter;


