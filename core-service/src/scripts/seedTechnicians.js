const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const Organization = require('../models/Organization');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cronus';

const seed = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const orgs = await Organization.find({});
  if (!orgs.length) {
    console.log('No organizations found');
    return mongoose.disconnect();
  }

  let created = 0;

  for (const org of orgs) {
    const existingTech = await User.findOne({ organization: org._id, role: 'technician' });
    if (existingTech) {
      console.log(`👷 Tech already exists for ${org.name}`);
      continue;
    }

    const user = new User({
      username: `tech_${org.name.toLowerCase().replace(/\s/g, '_')}`,
      email: `${org.name.toLowerCase().replace(/\s/g, '')}@techmail.com`,
      password: 'Password123!', // hash if needed elsewhere
      role: 'technician',
      organization: org._id,
    });

    await user.save();
    console.log(`✅ Created tech user for ${org.name}`);
    created++;
  }

  console.log(`\n✅ Created ${created} technicians`);
  mongoose.disconnect();
};

seed().catch(err => {
  console.error(err);
  mongoose.disconnect();
});