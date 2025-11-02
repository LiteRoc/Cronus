const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
const Task = require('../models/Task');
require('dotenv').config(); // if using dotenv for connection string

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/your-db-name');

  const workOrders = await WorkOrder.find({
    'procedure.taskResults': { $exists: true, $ne: [] }
  });

  console.log(`🔍 Found ${workOrders.length} work orders with procedures.`);

  for (const wo of workOrders) {
    let changed = false;

    const updatedTaskResults = await Promise.all(
      (wo.procedure?.taskResults || []).map(async (tr) => {
        const task = await Task.findById(tr.taskId);
        if (!task) return tr;

        const updated = {
          ...tr.toObject(),
          type: tr.type || task.type || 'Comment',
          minValue: tr.minValue ?? task.minValue ?? null,
          maxValue: tr.maxValue ?? task.maxValue ?? null,
          unitOfMeasure: tr.unitOfMeasure ?? task.unit ?? null,
        };

        // Only set changed flag if something was actually missing
        if (
          tr.type !== updated.type ||
          tr.minValue !== updated.minValue ||
          tr.maxValue !== updated.maxValue ||
          tr.unitOfMeasure !== updated.unitOfMeasure
        ) {
          changed = true;
        }

        return updated;
      })
    );

    if (changed) {
      wo.procedure.taskResults = updatedTaskResults;
      await wo.save();
      console.log(`✅ Updated WO ${wo._id}`);
    }
  }

  console.log('🎉 All done.');
  process.exit();
})();