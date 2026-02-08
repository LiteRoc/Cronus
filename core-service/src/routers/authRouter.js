const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Facility = require('../models/Facility');

const authRouter = express.Router();

// Secret for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Register Route
authRouter.post(
    '/register',
    [
        body('username').notEmpty().withMessage('Username is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
        body('role').optional().isIn(['admin', 'tech', 'customer']).withMessage('Role must be admin, tech, or customer'),
        body('customerId').optional().isMongoId().withMessage('customerId must be a valid Mongo ObjectId'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, role = 'tech', customerId } = req.body;

        try {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'Email is already registered' });
            }

            // Enforce customerId requirement if role=customer
            if (role === 'customer' && !customerId) {
                return res
                .status(400)
                .json({ error: 'customerId is required when role is customer' });
            }

            const user = new User({ username, email, password, role, customerId });
            await user.save();

            res.status(201).json({ message: 'User registered successfully' });
        } catch (error) {
            console.error('Error registering user:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

// Login Route
authRouter.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email }).populate('facilities', 'name');
      console.log('Returned user:', user);

      if (user && user.facilities.length === 0 && user.facilityId) {
          user.facilities = [user.facilityId];
      }
      
      if (!user) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }

      // Minimal, standard payload
      const payload = {
        id: user._id.toString(),         // standard JWT "subject"
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,                  // 'admin' | 'tech' | 'customer'
        facilityId: user.facilityId,
        departmentId: user.departmentId, // optional
        facilities: user.facilities?.map(f => f._id.toString())
      };

      console.log("JWT-bound facilities:", payload.facilities);

      const token = jwt.sign(
        payload,
        JWT_SECRET,
        {
          expiresIn: '12h',
          issuer: 'cronus.api',         // optional but recommended
          audience: 'cronus.app'        // optional but recommended
        }
      );

      // Optional: also set an HTTP-only cookie for browsers
      // res.cookie('auth', token, {
      //   httpOnly: true,
      //   sameSite: 'lax',
      //   secure: process.env.NODE_ENV === 'production',
      //   maxAge: 12 * 60 * 60 * 1000, // 12h
      // });

      // Respond with a UI-friendly user object
      res.json({
        token,
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          name: user.name || user.username, // if you want a display name
          facilityId: user.facilityId ? user.facilityId.toString() : null,
          departmentId: user.departmentId ? user.departmentId.toString() : null,
          facilities: user.facilities?.map((f) => ({
            id: f._id.toString(),
            name: f.name,
          })) || [],
        },
      });
      console.log('Frontend-bound user:', user);

    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

// Protected Profile Route
authRouter.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Middleware to Authenticate Token
function authenticateToken(req, res, next) {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied, token missing' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// route to serve the login page
authRouter.get('/login', (req, res) => {
    res.render('login', { title: 'Login' }); // Ensure the login.ejs file exists in the views folder
});

module.exports = authRouter;
