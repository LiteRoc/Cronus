const express = require('express');
const mongoose = require('mongoose');

require('dotenv').config();

const connectDB = require('./config/db'); // MongoDB connection logic
connectDB();

const app = express();

const contractRoutes = require('./routes/contractRoutes');
const analysisRoutes = require('./routes/contractAnalysisRoutes');
const customerRoutes = require('./routes/customerRoutes');

app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("Connected to MongoDB"))
.catch(err => console.error("MongoDB connection error:", err));

// Routers
app.use('/contracts', contractRoutes);
app.use('/contract-analysis', analysisRoutes);
app.use('/customer', customerRoutes);

const PORT = process.env.PORT || 5001;

// Server Start
app.listen(PORT, () => console.log(`Contract Service running on port ${PORT}`));