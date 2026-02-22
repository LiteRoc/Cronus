// scripts/seedAdmins.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); 
// if your .env is at /app/.env and seedAdmins.js is /app/src/scripts/seedAdmins.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User'); // adjust path to your User model

async function upsertAdmin({ username, email, password }) {
  const hash = await bcrypt.hash(password, 10);

  await User.updateOne(
    { email },
    {
      $set: {
        username,
        email,
        password: hash,
        role: 'admin',
        facilities: [],
        facilityId: null,
        departmentId: null,
        title: '',
        phone: '',
        isPrimary: true,
      },
    },
    { upsert: true }
  );

  console.log(`✅ upserted admin: ${email}`);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MONGO_URI?", process.env.MONGODB_URI ? "✅ set" : "❌ missing");

  await upsertAdmin({
    username: 'jfeatherston',
    email: 'Jason.Featherston@osumc.edu',
    password: 'password',
    role: 'admin'
  });

  await upsertAdmin({
    username: 'twalker',
    email: 'treavor.walker@osumc.edu',
    password: 'password',
    role: 'admin'
  });

  await mongoose.disconnect();
  console.log('🎉 done');
})();
