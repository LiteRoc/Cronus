// src/cronJobs/lifecycleScheduler.js
const cron = require('node-cron');
const Asset = require('../models/Asset');
const EquipmentTemplate = require('../models/EquipmentTemplate');

const { getMaintenanceTotals } = require('../services/lifecycleMaintenance'); // adjust if ESM
const { computeLifecycleMetrics } = require('../utils/lifecycle');       // adjust if ESM

async function recomputeLifecycleForAllAssets() {
  console.log('Running nightly lifecycle recompute...');

  // Page through assets to avoid loading everything at once
  const pageSize = 250;
  let lastId = null;
  let processed = 0;

  while (true) {
    const query = { deletedAt: null, isArchived: { $ne: true } };
    if (lastId) query._id = { $gt: lastId };

    const assets = await Asset.find(query)
      .sort({ _id: 1 })
      .limit(pageSize)
      .select('_id templateId purchase purchaseCost purchaseDate acquisitionDate installationDate metrics facilityId')
      .lean();

    if (assets.length === 0) break;

    // Load templates in batch for this page
    //const templateIds = [...new Set(assets.map(a => String(a.templateId)).filter(Boolean))];
    const templateIds = [
      ...new Set(
        assets
          .map(a => a.templateId)
          .filter(id => id && mongoose.Types.ObjectId.isValid(id))
          .map(String)
      )
    ];
    const templates = templateIds.length
      ? await EquipmentTemplate.find({ _id: { $in: templateIds } }).lean()
      : [];

    const templateMap = new Map(templates.map(t => [String(t._id), t]));

    // Bulk update for speed
    const ops = [];

    for (const asset of assets) {
      const template = asset.templateId ? templateMap.get(String(asset.templateId)) : null;

      // Maintenance totals
      const totals = await getMaintenanceTotals(asset._id);

      const metrics = computeLifecycleMetrics({
        asset,
        template,
        lifetimeMaintenanceTotal: totals.lifetime.total,
        last12MonthMaintenanceTotal: totals.last12Months.total,
      });

      ops.push({
        updateOne: {
          filter: { _id: asset._id },
          update: { $set: { metrics } },
        },
      });
    }

    if (ops.length) await Asset.bulkWrite(ops, { ordered: false });

    processed += assets.length;
    lastId = assets[assets.length - 1]._id;

    console.log(`Lifecycle recompute progress: ${processed} assets...`);
  }

  console.log(`Nightly lifecycle recompute completed. Updated ${processed} assets.`);
}

// Run every night at 1:15 AM (pick whatever)
cron.schedule('15 1 * * *', recomputeLifecycleForAllAssets);

module.exports = { recomputeLifecycleForAllAssets };