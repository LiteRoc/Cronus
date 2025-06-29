const mongoose = require('mongoose');
const Counter = require('./Counter'); // Import the Counter model
const debug = require('debug')('app:workOrderModel');

const taskResultSchema = new mongoose.Schema({
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    result: { type: mongoose.Schema.Types.Mixed, default: null }, // Pass/Fail, number, or comment
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Technician who submitted
    submittedByName: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const workOrderSchema = new mongoose.Schema({
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['Open', 'In Progress', 'Closed', 'Overdue'], default: 'Open' },
    requestDate: { type: Date, default: Date.now }, // New field for request/open date
    dueDate: { type: Date, required: true }, // New field for due date
    scheduledDate: { type: Date, required: true },
    completionDate: { type: Date, default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference for assignment
    workOrderType: { type: String, enum: ['Planned Maintenance', 'Corrective Maintenance'], required: true }, // New field
    notificationsSent: { type: Boolean, default: false }, // Track notifications
    timeLogs: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            timeSpent: { 
                type: Number, 
                required: true,
                validate: {
                    validator: Number.isInteger,
                    message: 'timeSpent must be a positive integer'
                },
                min: [1, 'timeSpent must be at least 1 minute']
            },
            description: { type: String, default: '' },
            timestamp: { type: Date, default: Date.now }
        }
    ],
    travelLogs: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            travelTime: { 
                type: Number,
                validate: {
                    validator: Number.isInteger,
                    message: 'travelTime must be a positive integer'
                },
                min: [1, 'travelTime must be at least 1 minute']
            },
            timestamp: { type: Date, default: Date.now }
        }
    ],
    partsUsed: [
        {
            partId: { type: mongoose.Schema.Types.ObjectId, ref: 'Part' },
            quantity: { type: Number, required: true }
        }
    ],
    workOrderNumber: { type: Number, unique: true }, // Readable and sequential number for Work Orders ... Change to Number rather than String
    testEquipmentUsed: [
        { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' }
    ],
    procedure:
        { type: mongoose.Schema.Types.ObjectId, ref: 'Procedure', default: null }, // Reference to a Procedure
    taskResults: [taskResultSchema] // Store task results per work order
}, { timestamps: true });

workOrderSchema.pre('save', async function (next) {
    if (!this.workOrderNumber) {
        try {
            debug('Generating workOrderNumber for new work order...');

            // Fetch and increment the counter atomically
            const counter = await Counter.findOneAndUpdate(
                { name: 'workOrderNumber' },
                { $inc: { value: 1 } },
                { new: true, upsert: true }
            );

            if (!counter) {
                debug('Counter document not found or created.');
                throw new Error('Failed to generate workOrderNumber.');
            }

            this.workOrderNumber = counter.value;
            debug(`Assigned workOrderNumber: ${this.workOrderNumber}`);
            next();
        } catch (error) {
            debug('Error in workOrderNumber generation:', error);
            next(error);
        }
    } else {
        debug(`Work order already has workOrderNumber: ${this.workOrderNumber}`);
        next();
    }
});




module.exports = mongoose.model('WorkOrder', workOrderSchema);