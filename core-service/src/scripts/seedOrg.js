// src/scripts/seedOrg.js

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); 
// if .env is at /app/.env and seedAdmins.js is /app/src/scripts/seedAdmins.js

const Org = require('../models/Organization');
const Facility = require('../models/Facility');
const Department = require('../models/Department');
const Organization = require('../models/Organization');

const MONGO_URI = process.env.MONGO_URI;

const seedData = [
    {
        org: {
            name: 'Ohio State Health Network',
            type: 'Health Network',
            notes: '',
        },
        facilities: [
            {
                name: 'Mary Rutan Hospital',
                code: 'MRH',
                phone: '(937) 592-4015',
                address: {
                    line1: '205 E Palmer Rd',
                    city: 'Bellefontaine',
                    state: 'OH',
                    zip: '43311'
                }
            },
            {
                name: 'Wayne Healthcare',
                code: 'WHC',
                phone: '(937) 548-1141',
                address: {
                    line1: '835 Sweitzer St',
                    city: 'Greenville',
                    state: 'OH',
                    zip: '45331'
                }
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
                    line1: fac.line1,
                    city: fac.city,
                    state: fac.state,
                    zip: fac.zip
                }
            });
            console.log(`🏨 Created facility: ${facility.name}`);
        }
    }
    console.log('Seed complete');
    process.exit;
}

seed();

