const express = require('express');
const debug = require('debug')('app');
const morgan = require('morgan');
const path = require('path');
const WorkOrder = require('./src/models/WorkOrder');
const expressLayouts = require('express-ejs-layouts');
const { authenticateToken } = require('./src/middleware/authMiddleware');
require('dotenv').config(); // Load environment variables
require('./src/cronJobs/cronJobs'); // Initialize all cron jobs
const { scheduleMaintenanceJobs } = require('./src/cronJobs/cronJobs');
const cors = require('cors');

const connectDB = require('./src/config/db'); // MongoDB connection logic
connectDB(); // Establish connection to MongoDB

/*const bcrypt = require('bcrypt');
const User = require('./src/models/User');
(async function seedAdmin() {
    const email = 'admin@example.com';
    const exists = await User.exists({ email });
    if (!exists) {
      const hash = await bcrypt.hash('password', 10);
      await User.create({
        username: 'admin',
        email,
        password: hash,
        role: 'admin'
      });
      console.log('🛠️  Created default admin user:', email);
    }
  })();*/

const app = express();

const assetRouter = require('./src/routers/assetsRouter');
const adminRouter = require('./src/routers/adminRouter');
const workOrderRouter = require('./src/routers/workOrderRouter');
const authRouter = require('./src/routers/authRouter');
const userRouter = require('./src/routers/userRouter');
const reportRouter = require('./src/routers/reportRouter');
const partRouter = require('./src/routers/partRouter');
const supplierRouter = require('./src/routers/supplierRouter');
const procedureRouter = require('./src/routers/procedureRouter');
const taskRouter = require('./src/routers/taskRouter');
const dashboardRouter = require('./src/routers/dashboardRouter');
const { title } = require('process');

// View Engine
app.set('views', './src/views');
app.set('view engine', 'ejs');

// Use express-ejs-layouts
app.use(expressLayouts);

// Set the default layout file
app.set('layout', 'layout'); // The layout file should be named layout.ejs and stored in views

// Allow requests from the React development server
app.use(cors({
    origin: 'http://localhost:5173', // React dev server
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], // Allow these HTTP methods
    allowedHeaders: [ 'Content-Type', 'Authorization'], // Allow necessary headers
    credentials: true, // If using cookies/auth
  }));

// Middleware
app.use(morgan('tiny'));
app.use(express.json()); // Enable JSON body parsing
app.use(express.urlencoded({ extended: true })); // Optional, for form submissions
app.use(express.static(path.join(__dirname, '/public')));

// Routers
app.use('/assets', assetRouter); // All asset-related routes, including nested work order routes
app.use('/admin', adminRouter);
app.use('/workorders', workOrderRouter); // path to view all Work Orders
app.use('/auth', authRouter); // All authentication routes will start with `/auth`
app.use('/users', userRouter);
app.use('/reports', reportRouter);
app.use('/parts', partRouter);
app.use('/suppliers', supplierRouter);
app.use('/procedures', procedureRouter);
app.use('/tasks', taskRouter);
app.use('/dashboard', dashboardRouter);

scheduleMaintenanceJobs();

// Root Route
app.get('/', async (req, res) => {
    const chalk = (await import('chalk')).default;
    res.render('index', { layout: false, title: 'Home' });
});

const PORT = process.env.PORT || 3000;

// Server Start
app.listen(PORT, async () => {
    const chalk = (await import('chalk')).default;
    debug(`listening on port ${chalk.green(PORT)}`);
});

// Route to fetch all work orders
app.get('/workorders', async (req, res) => {
    try {
        const workOrders = await WorkOrder.find({}); // Fetch all work orders
        res.status(200).json(workOrders);
    } catch (error) {
        console.error('Error fetching all work orders:', error.message);
        res.status(500).json({ error: 'Error fetching all work orders' });
    }
});

// protected route that only authenticate users can access ... redirected here once logged in
app.get('/dashboard', authenticateToken, (req, res) => {
    console.log('User accessing dashboard:', req.user); // Debug log
    console.log('Users role:', req.user.role); // Debug log
    res.render('dashboard', { user: req.user, title: 'User Dashboard' }); // Pass user info to the dashboard page
});

