// seedOrgs.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Facility = require('../models/Facility');
const Department = require('../models/Department');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;

const seedData = [
  {
    org: {
      name: 'Queen Health',
      type: 'Health System',
      notes: 'Champions of biomed excellence',
    },
    facilities: [
      {
        name: 'Bohemian Rhapsody Hospital',
        code: 'BRH',
        city: 'London',
        departments: [
          { name: 'Outpatient Surgery' },
          { name: 'Med/Surg' },
        ],
        users: [
          {
            username: 'freddie',
            email: 'freddie@queenhealth.org',
            role: 'customer',
            title: 'Director of Ops',
            dept: 'Outpatient Surgery',
          },
          {
            username: 'brian',
            email: 'brian@queenhealth.org',
            role: 'technician',
            title: 'Biomed Tech',
            dept: 'Med/Surg',
          }
        ]
      },
      {
        name: 'Under Pressure Clinic',
        code: 'UPC',
        city: 'Manchester',
        departments: [
          { name: 'Radiology' }
        ],
        users: [
          {
            username: 'roger',
            email: 'roger@queenhealth.org',
            role: 'customer',
            title: 'Radiology Supervisor',
            dept: 'Radiology',
          }
        ]
      }
    ]
  },
  {
    org: {
      name: 'Zeppelin Medical',
      type: 'University Health Network',
      notes: 'Lab-tested across the stars',
    },
    facilities: [
      {
        name: 'Kashmir Medical Center',
        code: 'ZSMC',
        city: 'London',
        departments: [
          { name: 'Cardiology' },
          { name: 'Surgery' },
        ],
        users: [
          {
            username: 'robert',
            email: 'robert@kashmir.org',
            role: 'customer',
            title: 'Head of Cardiology',
            dept: 'Cardiology',
          },
          {
            username: 'jimmy',
            email: 'jimmy@kashmir.org',
            role: 'technician',
            title: 'Field Tech',
            dept: 'Surgery',
          }
        ]
      }
    ]
  }
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('🚀 Connected to MongoDB');

  for (const group of seedData) {
    const org = await Organization.create(group.org);
    console.log(`🏥 Created organization: ${org.name}`);

    for (const fac of group.facilities) {
      const facility = await Facility.create({
        organizationId: org._id,
        name: fac.name,
        code: fac.code,
        address: {
          line1: `${Math.floor(Math.random() * 1000)} Rockstar Ave`,
          city: fac.city,
          state: 'UK',
          zip: '00000',
        },
        timezone: 'Europe/London',
      });
      console.log(`🏨 Created facility: ${facility.name}`);

      const deptMap = {};
      for (const d of fac.departments) {
        const department = await Department.create({
          facilityId: facility._id,
          name: d.name,
        });
        deptMap[d.name] = department._id;
        console.log(`  🏬 Created department: ${d.name}`);
      }

      for (const u of fac.users) {
        const password = await bcrypt.hash('test1234', 10);
        const user = await User.create({
          username: u.username,
          email: u.email,
          password,
          role: u.role,
          title: u.title,
          phone: '555-ROCK-ON',
          facilityId: facility._id,
          departmentId: deptMap[u.dept],
        });
        console.log(`    👤 Created user: ${user.username} (${u.role})`);
      }
    }
  }

  console.log('🎉 Seed complete');
  process.exit();
}

seed();