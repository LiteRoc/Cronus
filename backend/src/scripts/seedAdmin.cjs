const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const User = require('../models/User'); // adjust path as needed

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aegisops';

async function seedAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const existingAdmin = await User.findOne({ role: 'Admin' });
    if (existingAdmin) {
      console.log('Admin user already exists');
    } else {
      const notHashedPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

      const newAdmin = new User({
        username: 'jfeatherston',
        email: process.env.DEFAULT_ADMIN_EMAIL,
        password: notHashedPassword,
        role: 'admin'
      });

      await newAdmin.save();
      console.log('Admin user created');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error('Error seeding admin:', err);
    process.exit(1);
  }
}

seedAdmin();
