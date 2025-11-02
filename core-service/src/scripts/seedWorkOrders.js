const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const WorkOrder = require('../models/WorkOrder');
const Asset = require('../models/Asset');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Facility = require('../models/Facility');

const NUM_WORK_ORDERS = 10; // Change as needed

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cronus';

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const seed = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const orgs = await Organization.find({});
  if (orgs.length === 0) return console.log('No organizations found');

  let created = 0;

  for (const org of orgs) {
    const facilities = await Facility.find({ organizationId: org._id }).select('_id');
    console.log(`Found ${facilities.length} facilities for ${org.name}`);

    const facilityIds = facilities.map(f => f._id);
    console.log('FacilityIds found:', facilityIds);

    // 🔧 FIX: use facilityId not facility
    const assets = await Asset.find({ facilityId: { $in: facilityIds } });
    console.log(`Found ${assets.length} assets for ${org.name}`);

    const techs = await User.find({ facilityId: { $in: facilityIds }, role: 'technician' });
    console.log(`Found ${techs.length} techs for ${org.name}`);

    if (!assets.length || !techs.length) {
      console.log(`Skipping org ${org.name} — missing assets or techs`);
      continue;
    }

    const asset = getRandomItem(assets);
    const tech = getRandomItem(techs);

    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + 7);

    const workOrder = new WorkOrder({
      assetId: asset._id,
      assignedTo: tech._id,
      status: 'Open',
      requestDate: now,
      dueDate: due,
      description: `Auto-generated work order for testing`,
      workOrderType: getRandomItem(['Corrective Maintenance', 'Planned Maintenance']),
      workOrderNumber: Date.now() + created,
      notes: `Auto-generated WO for ${org.name}`,
      organization: org._id,
      facilityId: asset.facilityId,   // ✅ correct field
      departmentId: asset.departmentId,
    });

    await workOrder.save();

    // link it to the asset
    asset.workOrders.push(workOrder._id);
    await asset.save();

    created++;
    if (created >= NUM_WORK_ORDERS) break;
  }

  console.log(`✅ Seeded ${created} work orders.`);
  mongoose.disconnect();
};

seed().catch(err => {
  console.error(err);
  mongoose.disconnect();
});