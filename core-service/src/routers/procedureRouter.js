const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware')
const Procedure = require('../models/Procedure');
const Task = require('../models/Task');
const { buildTenantFilter } = require('../middleware/tenantScope');
const debug = require('debug')('app:procedureRouter');

const procedureRouter = express.Router();

// GET: Get Procedures w/Tasks
procedureRouter.get('/', authenticateToken, async (req, res) => {
    if (req.user.role === 'customer') {
        // Optional: only show procedures actually used by their assets/WOs
        const assetIds = await Asset.find(buildTenantFilter(req)).distinct('_id');
        const woProcIds = await WorkOrder.find({ assetId: { $in: assetIds } }).distinct('procedure');
        const procIds = new Set(woProcIds);
        const procs = await Procedure.find({ _id: { $in: Array.from(procIds) } }).populate('tasks');
        return res.json(procs);
    }

    // Internal: show all
    const procs = await Procedure.find({}).populate('tasks');
    res.json(procs);
});

// GET: Get a single procedure w/Tasks
procedureRouter.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) { return res.status(400).json({ error: 'Invalid ID format' })}

    try {
        const filter = { _id: id, ...buildTenantFilter(req) };
        const procedure = await Procedure.findOne(filter)
            .populate('tasks');

        if (!procedure) return res.status(404).json({ error: 'Procedure not found' });

        res.status(200).json(procedure);
    } catch {
        debug('Error fetching procedure:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

// ***Create/Update/Delete — internal only *** //

// POST: Create a Procedure with Reusable Tasks
procedureRouter.post('/', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
    const { name, tasks } = req.body;

    try {
        // Validate input
        if (!Array.isArray(tasks) || tasks.length === 0) {
            return res.status(400).json({ error: 'At least one task ID is required' });
        }

        // Validate tasks in the database
        const foundTasks = await Task.find({ _id: { $in: tasks } });
        if (foundTasks.length !== tasks.length) {
            return res.status(400).json({ error: 'Some task IDs are invalid' });
        }

        // Create the procedure with tasks and an empty taskResults array
        const procedure = new Procedure({
            name,
            tasks,
            taskResults: [], // Initialize empty; will populate when attached to work orders
        });

        // Save the procedure to the database
        await procedure.save();

        res.status(201).json({
            message: 'Procedure created successfully',
            procedure,
        });
    } catch (error) {
        console.error('Error creating procedure:', error);
        res.status(500).json({ error: 'Failed to create procedure' });
    }
});

// PUT: Update a procedure
procedureRouter.put('/:id', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => { /* update */ });

// PATCH: Remove a procedure / soft delete
procedureRouter.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => { /* delete */ });

// PATCH: Update a Procedure Task
procedureRouter.patch('/:procedureId/tasks/:taskId/result', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
    const { procedureId, taskId } = req.params;
    const { result, userId } = req.body;

    try {
        const procedure = await Procedure.findById(procedureId);
        if (!procedure) {
            return res.status(404).json({ error: 'Procedure not found' });
        }

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Validate result type
        if (task.type === 'Pass/Fail' && !['Pass', 'Fail'].includes(result)) {
            return res.status(400).json({ error: 'Invalid result for Pass/Fail task' });
        }
        if (task.type === 'Measurement' && (result < task.minValue || result > task.maxValue)) {
            return res.status(400).json({ error: `Result must be between ${task.minValue} and ${task.maxValue}` });
        }

        // Update task result
        const taskResult = procedure.taskResults.find(tr => tr.taskId.toString() === taskId);
        if (taskResult) {
            taskResult.result = result;
            taskResult.submittedBy = userId || null;
            taskResult.timestamp = new Date();
        } else {
            procedure.taskResults.push({
                taskId,
                result,
                submittedBy: userId || null,
                timestamp: new Date(),
            });
        }

        await procedure.save();
        res.status(200).json({ message: 'Task result updated', taskResults: procedure.taskResults });
    } catch (error) {
        console.error('Error updating task result:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = procedureRouter;
