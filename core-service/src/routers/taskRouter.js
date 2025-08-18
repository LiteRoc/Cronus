const express = require('express');
const Task = require('../models/Task');
const debug = require('debug')('app:taskRouter');

const taskRouter = express.Router();

// GET: Fetch Tasks
taskRouter.get('/', async (req, res) => {

    try {
        const tasks = await Task.find();
        res.status(200).json(tasks);
    } catch (error) {
        debug('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// POST: Create a Task
taskRouter.post('/', async (req, res) => {

    try {
        const task = new Task(req.body);
        await task.save();
        res.status(201).json({ message: 'Task created successfully', task });
    } catch (error) {
        debug('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

module.exports = taskRouter;


