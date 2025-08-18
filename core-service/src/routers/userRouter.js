const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const User = require('../models/User');

const userRouter = express.Router();

//console.log({ authenticateToken, authorizeRoles });

// Adding User Management Roles ... basic CRUD functions

// Get all users (Admin only)
userRouter.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude passwords
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Add a new user (Admin only)
userRouter.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const { username, email, password, role } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const newUser = new User({ username, email, password, role, phoneNumber});
        await newUser.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update a user (Admin only)
userRouter.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const { id } = req.params;
    const { username, email, role } = req.body;

    try {
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { username, email, role, phoneNumber },
            { new: true }
        );
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete a user (Admin only)
userRouter.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const { id } = req.params;

    try {
        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Add a route to render the user management page
userRouter.get('/manage', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.render('users', { users });
    } catch (error) {
        console.error('Error rendering user management page:', error);
        res.status(500).send('Internal Server Error');
    }
});

userRouter.get('/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; // Assuming authenticateToken sets req.user
        const user = await User.findById(userId).select('-password'); // Exclude password
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = userRouter;
