const express = require('express');
const WorkOrder = require('../models/WorkOrder');
const debug = require('debug')('app:workOrderRouter');
const Asset = require('../models/Asset');
const Part = require('../models/Part'); // Import the Part model
const Procedure = require('../models/Procedure'); // Import the Procedure Model
const TaskResult = require('../models/TaskResults')
const assetRouter = require('./assetsRouter');
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { sendEmail } = require('../services/notificationService');
const { error } = require('pdf-lib');

// Allows assetsRouter to access workOrderRouter to query work orders
const workOrderRouter = express.Router({ mergeParams: true }); // Merge parent params

// Check for overdue work orders and send notifications
cron.schedule('0 0 * * *', async () => {
    try {
        const overdueWorkOrders = await WorkOrder.find({
            status: { $ne: 'Completed' },
            scheduledDate: { $lt: new Date() },
            notificationsSent: false
        });

        for (const workOrder of overdueWorkOrders) {
            const user = await User.findById(workOrder.assignedTo);
            if (user?.email) {
                await sendEmail(
                    user.email,
                    'Overdue Work Order Reminder',
                    `Work Order ID ${workOrder._id} is overdue. Please address it immediately.`
                );
            }

            workOrder.notificationsSent = true;
            await workOrder.save();
        }

        console.log(`Processed ${overdueWorkOrders.length} overdue work orders.`);
    } catch (error) {
        debug('Error in notification cron job:', error);
    }
});

// GET all work orders assigned to a specific user
workOrderRouter.get('/assigned/:userId', async (req, res) => {
    const { userId } = req.params;

    debug('Received userId:', userId); // Log the incoming userId

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid User ID Format:', userId);
        return res.status(400).json({ error: 'Invalid user ID format' });
    }

    try {
        const query = { assignedTo: new mongoose.Types.ObjectId(userId) };
        debug('Database Query:', query);

        const workOrders = await WorkOrder.find(query).populate('assetId');
        debug('Work Orders Found:', workOrders); // Log the result
        debug('Work Order(s) Found:', query);

        if (workOrders.length === 0) {
            debug.warn('No Work Orders Found for User:', userId);
            return res.status(404).json({ message: 'No work orders found for this user'});
        }
        res.status(200).json(workOrders);
    } catch (error) {
        debug('Error fetching assigned work orders:', error);
        res.status(500).json({ error: 'Error fetching assigned work orders' });
    }
});

// GET all work orders for a specific asset or query by status
workOrderRouter.get('/', async (req, res) => {
    const { assetId } = req.params;
    const { search, status, type, page = 1, limit = 10 } = req.query;

    console.log('Backend triggered by query:', req.query);

    try {
        const query = {};
        if (search) {
            query.$or = [
                { status: { $regex: search, $options: 'i' } },
                { type: { $regex: search, $options: 'i' } },
            ]
        }

        // Filter by assetId if present
        if (assetId) {
            if (!mongoose.Types.ObjectId.isValid(assetId)) {
                return res.status(400).json({ error: 'Invalid assetId format' });
            }
            query.assetId = new mongoose.Types.ObjectId(assetId);
        }

        // Filter by status if provided in query
        if (status) {
            if (!['Open', 'In Progress', 'Closed', 'Overdue'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status value' });
            }
            query.status = status;
            console.log('MongoDB Query:', query);
        }
        
        // Filter by type if provided in query
        if (type) {
            if (!['Planned Maintenance', 'Corrective Maintenance'].includes(type)) {
                return res.status(400).json({ error: 'Invalid type value' });
            }
            query.type = type;
            console.log('MongoDB Query:', query);
        }

        // Parse the `page` and `limit` to ensure they are numbers
        const pageNumber = parseInt(page, 10) || 1; // Default to 1 if not provided
        const limitNumber = parseInt(limit, 10) || 10; // Default to 10 if not provided
        const skip = (pageNumber - 1) * limitNumber;

        // Fetch total count and paginated work orders
        const totalWorkOrders = await WorkOrder.countDocuments(query);
        const workOrders = await WorkOrder.find(query)
            .skip(skip)
            .limit(limitNumber)
            .populate('assetId')
            .populate('assignedTo', 'username email') // Include user details
            .lean();

        if (workOrders.length === 0) {
            return res.status(404).json({ message: 'No work orders found' });
        }

        res.status(200).json({
            workOrders,
            totalPages: Math.ceil(totalWorkOrders / limitNumber),
            currentPage: pageNumber,
            totalWorkOrders,
        });
    } catch (error) {
        debug('Error fetching work orders:', error);
        res.status(500).json({ error: 'Error fetching work orders' });
    }
});

// GET: Retrieve time logs for a specific work order
workOrderRouter.get('/:id/timelogs', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.query;

    // Validate work order ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid work order ID format' });
    }

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
    }

    try {
        const workOrder = await WorkOrder.findById(id).populate('timeLogs.userId', 'username email');

        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        const filteredTimeLogs = userId
            ? workOrder.timeLogs.filter(log => log.userId?._id?.toString() === userId)
            : workOrder.timeLogs;

        res.status(200).json({ timeLogs: filteredTimeLogs });
    } catch (error) {
        debug('Error retrieving time logs:', error);
        res.status(500).json({ error: 'Error retrieving time logs' });
    }
});

// GET: Total time spent on a work order
workOrderRouter.get('/:id/total-time', async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid work order ID format' });
    }

    try {
        const workOrder = await WorkOrder.findById(id);

        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        const totalTime = workOrder.timeLogs.reduce((sum, log) => sum + log.timeSpent, 0);

        res.status(200).json({ totalTime });
    } catch (error) {
        debug('Error calculating total time:', error);
        res.status(500).json({ error: 'Error calculating total time' });
    }
});

// GET: Retrieve Procedure for a Work Order
workOrderRouter.get('/:id/procedure', async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid work order ID' });
    }

    try {
        const workOrder = await WorkOrder.findById(id);

        if (!workOrder || !workOrder.procedure) {
            return res.status(404).json({ error: 'Procedure not found for this work order' });
        }

        res.status(200).json(workOrder.procedure);
    } catch (error) {
        console.error('Error retrieving procedure:', error);
        res.status(500).json({ error: 'Failed to retrieve procedure' });
    }
});

// POST: Create a new work order for an asset
workOrderRouter.post('/', async (req, res) => {
    const { assetId, description, status, assignedTo, scheduledDate, workOrderType } = req.body;

    try {
        // Validate input fields
        if (!assetId || !description || !scheduledDate || !workOrderType) {
            return res.status(400).json({ error: 'assetId, description, scheduledDate, and workOrderType are required' });
        }

        // Automatically set the requestDate to now and dueDate to 7 days from now
        const requestDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(requestDate.getDate() + 7);

        // Create the work order
        const newWorkOrder = new WorkOrder({
            assetId,
            description,
            status: status || 'Open',
            assignedTo: assignedTo || null,
            scheduledDate,
            requestDate,
            dueDate,
            workOrderType
        });

        // Add work order to the asset's workOrders array
        await Asset.findByIdAndUpdate(
            assetId,
            { $push: { workOrders: newWorkOrder._id } },
            { new: true }
        );

        await newWorkOrder.save();

        res.status(201).json({ message: 'Work order created successfully', workOrder: newWorkOrder });
    } catch (error) {
        console.error('Error creating work order:', error);
        res.status(500).json({ error: 'Failed to create work order' });
    }
});

// PUT: Update a specific work order by ID
workOrderRouter.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { userId, ...updateFields } = req.body;

    if (updateFields.status === "Complete") {
       updateFields.status = "Closed";
    }

    if (updateFields.status === "Closed") {
       updateFields.completionDate = new Date();
    } else {
       updateFields.completionDate = null;
    }


    // Validate work order ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid work order ID format' });
    }

    // Validate userId if it's provided
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
    }

    try {
        // Add userId to updateFields if provided
        if (userId) {
            updateFields.assignedTo = userId;
        }
        const updatedWorkOrder = await WorkOrder.findByIdAndUpdate(id, updateFields, { new: true });
        if (!updatedWorkOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }
        res.status(200).json(updatedWorkOrder);
    } catch (error) {
        res.status(500).json({ error: 'Error updating work order' });
    }
});

// PUT: Update work orders based on status
workOrderRouter.put('/:id/status', async (req, res) => {
    const { id } = req.params;
    let { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid work order ID format' });
    }

    // Normalize "Complete" to "Closed"
    if (status === "Complete") {
        status = "Closed";
    }

    if (!['Open', 'In Progress', 'Closed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }

    const update = { status };
    console.log('Status update triggered:', status, '→', update);

    if (status === "Closed") {
        update.completionDate = new Date(); // ✅ Set completion date only when closing
    } else {
        update.completionDate = null; // Optional: clear it if reopening
    }

    try {
        const updatedWorkOrder = await WorkOrder.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updatedWorkOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        res.status(200).json(updatedWorkOrder);
    } catch (error) {
        debug('Error updating status:', error);
        res.status(500).json({ error: 'Error updating status' });
    }
});

// PATCH: Add a time log to a work order
workOrderRouter.patch('/:id/timeLogs', async (req, res) => {
    const { id } = req.params;
    const { userId, timeSpent, description } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid work order or user ID' });
        }

        if (!Number.isInteger(timeSpent) || timeSpent <= 0) {
            return res.status(400).json({ error: 'timeSpent must be a positive integer' });
        }

        const workOrder = await WorkOrder.findById(id);

        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        // Add new time log entry
        workOrder.timeLogs.push({
            userId,
            timeSpent,
            description: description || ''
        });

        await workOrder.save();

        res.status(200).json({ message: 'Time log added successfully', workOrder });
    } catch (error) {
        console.error('Error adding time log:', error);
        res.status(500).json({ error: 'Failed to add time log' });
    }
});

// PATCH: Add Travel Logs
workOrderRouter.patch('/:id/travelLogs', async (req, res) => {
    const { id } = req.params;
    const { userId, travelTime } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid work order or user ID' });
        }

        if (!Number.isInteger(travelTime) || travelTime <= 0) {
            return res.status(400).json({ error: 'travelTime must be a positive integer' });
        }

        const workOrder = await WorkOrder.findById(id);

        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        // Add new travel log entry
        workOrder.travelLogs.push({
            userId,
            travelTime
        });

        await workOrder.save();

        res.status(200).json({ message: 'Travel log added successfully', workOrder });
    } catch (error) {
        console.error('Error adding travel log:', error);
        res.status(500).json({ error: 'Failed to add travel log' });
    }
});

// PATCH: Update a specific time log
workOrderRouter.patch('/:id/timelogs/:logId', async (req, res) => {
  const { id, logId } = req.params;
  const { timeSpent, description } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(logId)) {
    return res.status(400).json({ error: 'Invalid work order or log ID' });
  }

  try {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    const log = workOrder.timeLogs.id(logId); // ✅ access subdocument
    if (!log) {
      return res.status(404).json({ error: 'Time log not found' });
    }

    if (typeof timeSpent === 'number') log.timeSpent = timeSpent;
    if (typeof description === 'string') log.description = description;

    await workOrder.save();
    res.status(200).json({ message: 'Time log updated', log });
  } catch (err) {
    console.error('Error updating time log:', err);
    res.status(500).json({ error: 'Failed to update time log' });
  }
});

// PATCH: Update a specific travel log
workOrderRouter.patch('/:id/travellogs/:logId', async (req, res) => {
  const { id, logId } = req.params;
  const { travelTime } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(logId)) {
    return res.status(400).json({ error: 'Invalid work order or log ID' });
  }

  try {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    const log = workOrder.travelLogs.id(logId);
    if (!log) {
      return res.status(404).json({ error: 'Travel log not found' });
    }

    if (typeof travelTime === 'number') {
      log.travelTime = travelTime;
    }

    await workOrder.save();
    res.status(200).json({ message: 'Travel log updated', log });
  } catch (err) {
    console.error('Error updating travel log:', err);
    res.status(500).json({ error: 'Failed to update travel log' });
  }
});

// PATCH: Add parts to work orders
workOrderRouter.patch('/:id/parts', async (req, res) => {
    const { id } = req.params;
    const { partId, quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(partId)) {
        return res.status(400).json({ error: 'Invalid work order ID or part ID' });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'Invalid quantity' });
    }

    try {
        const workOrder = await WorkOrder.findById(id);
        const part = await Part.findById(partId);

        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        if (!part) {
            return res.status(404).json({ error: 'Part not found' });
        }

        if (part.quantityOnHand < quantity) {
            return res.status(400).json({ error: 'Insufficient stock for this part' });
        }

        // Update partsUsed in the work order
        workOrder.partsUsed.push({ partId, quantity });

        // Decrement stock
        part.quantityOnHand -= quantity;

        await workOrder.save();
        await part.save();

        res.status(200).json({ message: 'Part added to work order', workOrder });
    } catch (error) {
        debug('Error adding part to work order:', error);
        res.status(500).json({ error: 'Failed to add part to work order' });
    }
});

// PATCH: Update part quantity on a work order
workOrderRouter.patch('/:id/parts/:partId', async (req, res) => {
  const { id, partId } = req.params;
  const { quantity } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(partId)) {
    return res.status(400).json({ error: 'Invalid work order or part ID' });
  }

  console.log(`PATCH called for partId ${partId} on workOrder ${id}`, req.body);

  try {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) return res.status(404).json({ error: 'Work order not found' });

    const partEntry = workOrder.partsUsed.find(p => p.partId.toString() === partId);
    if (!partEntry) return res.status(404).json({ error: 'Part not found in work order' });

    if (typeof quantity === 'number' && quantity > 0) {
      partEntry.quantity = quantity;
      await workOrder.save();
      return res.status(200).json({ message: 'Part quantity updated', part: partEntry });
    } else {
      return res.status(400).json({ error: 'Invalid quantity' });
    }
  } catch (err) {
    console.error('Error updating part quantity:', err);
    res.status(500).json({ error: 'Failed to update part' });
  }
});

// PATCH:  Add test equip to WO
workOrderRouter.patch('/:id/test-equipment', async (req, res) => {
    const { id } = req.params;
    const { equipmentId } = req.body;
    debug('Equipment Id to add:', equipmentId);

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(equipmentId)) {
        return res.status(400).json({ error: 'Invalid work order ID or equipment ID' });
    }

    debug('Asset Model:', Asset); // Debug Log

    try {
        const workOrder = await WorkOrder.findById(id);
        const equipment = await Asset.findById(equipmentId);
        debug('Equipment being added:', equipment); // Debug Log

        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        if (!equipment || equipment.category !== 'test') {
            return res.status(400).json({ error: 'Equipment is not valid test equipment' });
        }

        // Add test equipment to the work order
        if (!workOrder.testEquipmentUsed.includes(equipmentId)) {
            workOrder.testEquipmentUsed.push(equipmentId);
        }

        await workOrder.save();

        res.status(200).json({ message: 'Test equipment added to work order', workOrder });
    } catch (error) {
        debug('Error associating test equipment:', error);
        res.status(500).json({ error: 'Failed to associate test equipment' });
    }
});

// PATCH: Add or Update Procedure for a Work Order
workOrderRouter.patch('/:id/procedure', async (req, res) => {
    const { id } = req.params;
    const { procedureId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(procedureId)) {
        return res.status(400).json({ error: 'Invalid work order ID or procedure ID' });
    }

    try {
        const workOrder = await WorkOrder.findById(id);
        const procedure = await Procedure.findById(procedureId).populate('tasks');

        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        if (!procedure) {
            return res.status(404).json({ error: 'Procedure not found' });
        }

        // Initialize taskResults in the procedure if not already present
        if (!procedure.taskResults || procedure.taskResults.length === 0) {
            procedure.taskResults = procedure.tasks.map(task => ({
                taskId: task._id,
                result: null, // Initialize with null result
            }));

            // Save the updated procedure
            await procedure.save();
        }

        // Assign the procedure to the work order
        workOrder.procedure = procedureId;

        debug('Work Order before saving:', JSON.stringify(workOrder, null, 2));
        await workOrder.save();

        res.status(200).json({ message: 'Procedure assigned to work order', workOrder });
    } catch (error) {
        debug('Error assigning procedure:', error);
        res.status(500).json({ error: 'Failed to assign procedure' });
    }
});

// PATCH: Save Task Results for a Work Order
/*workOrderRouter.patch('/:workOrderId/task-results', async (req, res) => {
    try {
        const { workOrderId } = req.params;
        const { taskResults } = req.body; // Array of results

        const workOrder = await WorkOrder.findById(workOrderId);
        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        // Update task results inside the work order
        workOrder.taskResults = taskResults.map(result => ({
            taskId: result.taskId,
            result: result.result,
            submittedBy: result.submittedBy,
            timestamp: new Date()
        }));

        await workOrder.save();
        res.json({ success: true, message: 'Task results saved successfully.', workOrder });
    } catch (error) {
        console.error('Error saving task results:', error);
        res.status(500).json({ success: false, message: 'Failed to save task results.' });
    }
});*/

// PATCH: Save Task Results for a Work Order
workOrderRouter.patch('/:workOrderId/procedure/:procedureId/task-results', async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const { taskResults } = req.body;

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    workOrder.taskResults = taskResults;
    await workOrder.save();

    res.json({ success: true, message: 'Task results saved successfully.', workOrder });
  } catch (error) {
    console.error('Error saving task results:', error);
    res.status(500).json({ success: false, message: 'Failed to save task results.' });
  }
});

// DELETE: Remove a work order by ID
workOrderRouter.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid work order ID format' });
    }

    try {
        const deletedWorkOrder = await WorkOrder.findByIdAndDelete(id);
        if (!deletedWorkOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }
        res.status(200).json({ message: 'Work order deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting work order' });
    }
});

// DELETE: Remove a specific time log
workOrderRouter.delete('/:id/timelogs/:logId', async (req, res) => {
  const { id, logId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(logId)) {
    return res.status(400).json({ error: 'Invalid work order or log ID' });
  }

  try {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    const log = workOrder.timeLogs.id(logId);
    if (!log) {
      return res.status(404).json({ error: 'Time log not found' });
    }

    log.deleteOne(); // ✅ remove subdocument
    await workOrder.save();

    res.status(200).json({ message: 'Time log deleted' });
  } catch (err) {
    console.error('Error deleting time log:', err);
    res.status(500).json({ error: 'Failed to delete time log' });
  }
});

// DELETE: Remove a specific travel log
workOrderRouter.delete('/:id/travellogs/:logId', async (req, res) => {
  const { id, logId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(logId)) {
    return res.status(400).json({ error: 'Invalid work order or log ID' });
  }

  try {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    const log = workOrder.travelLogs.id(logId);
    if (!log) {
      return res.status(404).json({ error: 'Travel log not found' });
    }

    log.deleteOne(); // ✅ modern Mongoose removal
    await workOrder.save();

    res.status(200).json({ message: 'Travel log deleted' });
  } catch (err) {
    console.error('Error deleting travel log:', err);
    res.status(500).json({ error: 'Failed to delete travel log' });
  }
});

// DELETE: Remove a part from a work order
workOrderRouter.delete('/:id/parts/:partId', async (req, res) => {
  const { id, partId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(partId)) {
    return res.status(400).json({ error: 'Invalid work order or part ID' });
  }

  console.log(`DELETE called for partId ${partId} on workOrder ${id}`);

  try {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) return res.status(404).json({ error: 'Work order not found' });

    const initialCount = workOrder.partsUsed.length;

    workOrder.partsUsed = workOrder.partsUsed.filter((p) => {
        console.log("Comparing:", p.partId.toString(), "vs", partId.toString());
        return p.partId.toString() !== partId.toString();
    });


    if (workOrder.partsUsed.length === initialCount) {
      return res.status(404).json({ error: 'Part not found in work order' });
    }

    await workOrder.save();
    res.status(200).json({ message: 'Part removed from work order' });
  } catch (err) {
    console.error('Error deleting part from work order:', err);
    res.status(500).json({ error: 'Failed to delete part from work order' });
  }
});

// DELETE: Remove procedure from a work order
workOrderRouter.delete('/:id/procedure/:procedureId', async (req, res) => {
  const { id } = req.params;

  try {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    // Remove the procedure reference and optionally clear taskResults
    workOrder.procedure = undefined;
    workOrder.taskResults = [];

    await workOrder.save();

    res.status(200).json({ message: 'Procedure removed from work order.' });
  } catch (error) {
    console.error('Error removing procedure:', error);
    res.status(500).json({ error: 'Failed to remove procedure' });
  }
});

// GET: Fetch Task Results for a Work Order
workOrderRouter.get('/:workOrderId/procedure/:procedureId/task-results', async (req, res) => {
    try {
        const { workOrderId, procedureId } = req.params;

        const taskResults = await TaskResult.find({
            workOrderId,
            procedureId,
        }).populate('taskId', 'description type'); // Include task details

        res.json({ success: true, taskResults });
    } catch (error) {
        console.error('Error fetching task results:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch task results.' });
    }
});

// GET: get a single work order
workOrderRouter.get('/:id', async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid work order ID format' });
    }

    try {
        const workOrder = await WorkOrder.findById(id)
            .populate('partsUsed.partId') //, 'partNumber description price quantityOnHand')
            .populate('timeLogs.userId')
            .populate('travelLogs.userId')
            .populate('testEquipmentUsed') // Populate test equipment details
            .populate('procedure')
            .populate({
                path: 'procedure',
                populate: {
                    path: 'tasks',
                    select: '_id description',
                },
            })
            .lean(); // Optional: Convert Mongoose document to plain object

        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        res.status(200).json(workOrder);
    } catch (error) {
        debug('Error fetching work order:', error);
        res.status(500).json({ error: 'Failed to fetch work order' });
    }
});

// GET: Retrieve task results for a specific work order
workOrderRouter.get('/:workOrderId/task-results', async (req, res) => {
    try {
        const { workOrderId } = req.params;

        const workOrder = await WorkOrder.findById(workOrderId).populate('taskResults.taskId', 'description');
        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        res.json({ success: true, taskResults: workOrder.taskResults });
    } catch (error) {
        console.error('Error fetching task results:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch task results.' });
    }
});

module.exports = workOrderRouter;
