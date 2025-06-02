// src/scripts/resetPassword.cjs
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aegisops';

async function resetPassword(email, newPassword) {
  try {
    await mongoose.connect(MONGO_URI);
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User not found: ${email}`);
      return;
    }

    //const hash = await bcrypt.hash(newPassword, 10);
    user.password = 'newPassword';
    await user.save();

    console.log(`✅ Password updated for ${email}`);
  } catch (err) {
    console.error('❌ Error resetting password:', err);
  } finally {
    await mongoose.disconnect();
  }
}

// Usage
resetPassword('admin@example.com', 'newPassword123');