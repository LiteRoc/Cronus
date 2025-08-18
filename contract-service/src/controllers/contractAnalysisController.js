const contractAnalysis = require('../models/ContractAnalysis');

// GET - Generate analysis for a contract
exports.getAnalysis = async (req, res) => {
    const { contractId, year } = req.params;
  const targetYear = parseInt(year);

  if (isNaN(targetYear)) return res.status(400).json({ error: 'Invalid year format' });

  try {
    const contract = await Contract.findById(contractId).populate('coveredAssets');
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    // Get all work orders tied to contract (via covered assets)
    const assetIds = contract.coveredAssets.map(a => a._id);

    const start = new Date(`${targetYear}-01-01`);
    const end = new Date(`${targetYear + 1}-01-01`);

    const workOrders = await WorkOrder.find({
      assetId: { $in: assetIds },
      completionDate: { $gte: start, $lt: end }
    }).populate('partsUsed.partId').populate('timeLogs.userId');

    let totalPartsCost = 0;
    let totalLaborHours = 0;
    let laborRate = 120; // Placeholder, customize later

    for (const wo of workOrders) {
      for (const partUsage of wo.partsUsed) {
        totalPartsCost += (partUsage.partId?.price || 0) * partUsage.quantity;
      }
      for (const log of wo.timeLogs) {
        totalLaborHours += log.timeSpent || 0;
      }
    }

    const totalLaborCost = totalLaborHours * laborRate;

    const estimatedInHouseCost = totalPartsCost + (totalLaborHours * laborRate);
    const netGainLoss = (contract.totalValue || 0) - estimatedInHouseCost;

    const analysis = await ContractAnalysis.findOneAndUpdate(
      { contractId, year: targetYear },
      {
        contractId,
        year: targetYear,
        totalWorkOrderCost: totalPartsCost + (totalLaborHours * laborRate),
        totalPartsCost,
        totalLaborHours,
        totalLaborCost,
        contractValue: contract.totalValue,
        estimatedInHouseCost,
        netGainLoss,
        performanceRating: netGainLoss > 0 ? 'good' : netGainLoss < 0 ? 'poor' : 'neutral'
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, analysis });
  } catch (err) {
    console.error('Error generating contract analysis:', err);
    res.status(500).json({ error: 'Failed to generate analysis' });
  }
};