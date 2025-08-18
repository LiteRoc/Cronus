// seed.js

const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const WorkOrder = require('../models/WorkOrder');
const Part = require('../models/Part');
const Procedure = require('../models/Procedure');
const Task = require('../models/Task');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aegisops';

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear old data
    await Asset.deleteMany();
    await Part.deleteMany();
    await WorkOrder.deleteMany();

    // Seed assets
    const assets = await Asset.insertMany([
      {
        ctrlNumber: 'A1001',
        manufacturer: 'GE',
        model: 'Monitor 5000',
        serialNumber: 'SN123456',
        description: 'Vital Signs Monitor',
        category: 'Biomed',
        status: 'Active'
      },
      {
        ctrlNumber: 'A1002',
        manufacturer: 'Philips',
        model: 'IntelliVue MX700',
        serialNumber: 'SN789012',
        description: 'Patient Monitor',
        category: 'Biomed',
        status: 'Active'
      },
      {
        ctrlNumber: 'TST1001',
        manufacturer: 'Fluke Biomedical',
        model: 'ESA615',
        serialNumber: 'ESA615-00123',
        description: 'Electrical Safety Analyzer for medical device testing',
        category: 'test',
        status: 'Active'
      }
    ]);

    // Seed parts
    const parts = await Part.insertMany([
      {
        partNumber: 'P-001',
        description: 'Battery Pack',
        price: 89.99,
        quantityOnHand: 10,
        location: 'Shelf A1'
      },
      {
        partNumber: 'P-002',
        description: 'ECG Cable',
        price: 19.99,
        quantityOnHand: 25,
        location: 'Shelf B3'
      }
    ]);

    // Create tasks
    const tasks = await Task.insertMany([
    {
        description: 'Check Power Cord Integrity',
        type: 'Pass/Fail'
    },
    {
        description: 'Measure Leakage Current',
        type: 'Measurement',
        minValue: 0,
        maxValue: 300 // µA
    },
    {
        description: 'Measure Ground Resistance',
        type: 'Measurement',
        minValue: 0,
        maxValue: 0.5 // Ohms
    }
    ]);

    // Create procedure
    const procedure = await Procedure.create({
    name: 'Electrical Safety Test',
    tasks: tasks.map(task => task._id)
    });

    // Seed work orders
    await WorkOrder.insertMany([
      {
        assetId: assets[0]._id,
        description: 'Battery replacement needed',
        workOrderNumber: 1,
        workOrderType: 'Corrective Maintenance',
        status: 'Open',
        requestDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scheduledDate: new Date(),
        partsUsed: [{ partId: parts[0]._id, quantity: 1 }],
        timeLogs: [],
        travelLogs: []
      },
      {
        assetId: assets[1]._id,
        description: 'Annual PM',
        workOrderNumber: 2,
        workOrderType: 'Planned Maintenance',
        status: 'Open',
        requestDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        scheduledDate: new Date(),
        partsUsed: [{ partId: parts[0]._id, quantity: 1 }],
        timeLogs: [],
        travelLogs: []
      },
      {
        assetId: assets[0]._id,
        workOrderNumber: 3,
        description: 'Annual electrical safety testing for monitor',
        status: 'Open',
        requestDate: new Date(),
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        scheduledDate: new Date(),
        workOrderType: 'Planned Maintenance',
        partsUsed: [],
        procedure: procedure._id,
        taskResults: tasks.map(task => ({
            taskId: task._id,
            result: null // Technicians will complete this later
        }))
      }
    ]);

    console.log('Seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();