require('dotenv').config();
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
const Asset = require('../models/Asset');
const Contract = require('../models/Contract');
const ContractAnalysis = require('../models/ContractAnalysis');
const { ObjectId } = mongoose.Types;

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aegisops';

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const contracts = await Contract.find({}).populate('coveredAssets');
    if (!contracts.length) throw new Error('No contracts found');

    await WorkOrder.deleteMany({ description: /FAKE ANALYSIS/ });
    await ContractAnalysis.deleteMany({});

    const laborRate = 100;

    for (const contract of contracts) {
      const year = 2024;
      let totalPartsCost = 0;
      let totalLaborHours = 0;

      for (const asset of contract.coveredAssets) {
        for (let i = 0; i < 2; i++) {
          const timeSpent = randomInt(1, 4); // hours
          const partPrice = randomInt(50, 200);
          const quantity = randomInt(1, 3);

          totalLaborHours += timeSpent;
          totalPartsCost += partPrice * quantity;

          const wo = new WorkOrder({
            assetId: asset._id,
            description: `FAKE ANALYSIS WO ${i + 1}`,
            workOrderNumber: Date.now() + i + Math.floor(Math.random() * 1000), // ✅ Unique
            status: 'Closed',
            scheduledDate: new Date(`${year}-04-${randomInt(1, 28)}`),
            completionDate: new Date(`${year}-04-${randomInt(1, 28)}`),
            dueDate: new Date(`${year}-05-${randomInt(1, 28)}`),
            requestDate: new Date(`${year}-03-${randomInt(1, 28)}`),
            workOrderType: contract.type === 'vendor' ? 'Corrective Maintenance' : 'Planned Maintenance',
            timeLogs: [{ userId: new ObjectId(), timeSpent }],
            partsUsed: [{
                partId: new ObjectId(),
                quantity,
                priceOverride: partPrice
            }]
          });



          await wo.save();
        }
      }

      const estimatedInHouse = totalPartsCost + (totalLaborHours * laborRate);
      const net = (contract.totalValue || 0) - estimatedInHouse;

      await ContractAnalysis.create({
        contractId: contract._id,
        year,
        totalWorkOrderCost: totalPartsCost + (totalLaborHours * laborRate),
        totalPartsCost,
        totalLaborHours,
        contractValue: contract.totalValue,
        estimatedInHouseCost: estimatedInHouse,
        netGainLoss: net,
        performanceRating: net > 0 ? 'good' : net < 0 ? 'poor' : 'neutral'
      });

      console.log(`✅ Analyzed contract "${contract.name}" for ${year}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding contract analysis:', err);
    process.exit(1);
  }
})();