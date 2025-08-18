const express = require('express');
const mongoose = require('mongoose');
const Procedure = require('../models/Procedure');
const Task = require('../models/Task');
const debug = require('debug')('app:procedureRouter');

const procedureRouter = express.Router();

// GET: Get Procedures w/Tasks
procedureRouter.get('/', async (req, res) => {
    try {
        const procedures = await Procedure.find().populate('tasks');
        res.status(200).json(procedures);
    } catch (error) {
        debug('Error fetching procedures:', error);
        res.status(500).json({ error: 'Failed to fetch procedures' });
    }
});

// POST: Create a Procedure with Reusable Tasks
procedureRouter.post('/', async (req, res) => {
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

procedureRouter.patch('/:procedureId/tasks/:taskId/result', async (req, res) => {
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
