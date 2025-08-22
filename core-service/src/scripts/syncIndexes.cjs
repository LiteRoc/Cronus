/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');

// --- Load your models here ---
const User = require('../models/User');
const Asset = require('../models/Asset');
const WorkOrder = require('../models/WorkOrder');
const EquipmentTemplate = require('../models/EquipmentTemplate');
/** Uncomment any that exist in your app */
// const Part = require('../models/Part');
// const Procedure = require('../models/Procedure');
// const Task = require('../models/Task');

const MODE = (process.env.INDEX_SYNC_MODE || 'create').toLowerCase();
// 'create'  -> createIndexes() only (safe; won’t drop anything)
// 'sync'    -> syncIndexes() (adds missing, drops extra indexes on the collection)

const MODE_FN = {
  create: (Model) => Model.createIndexes(),
  sync:   (Model) => Model.syncIndexes(),
};

const MODE_LABEL = {
  create: 'createIndexes',
  sync:   'syncIndexes',
};

const MODE_WARNING = `
[!] You are running MODE=${MODE_LABEL[MODE]}. 
- 'createIndexes' will add missing indexes (safe).
- 'syncIndexes' will also DROP indexes not in your schema (be sure you want this).
`;

async function main() {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    'mongodb://localhost:27017/aegisops';

  console.log(`[syncIndexes] Connecting to: ${uri}`);
  await mongoose.connect(uri, {
    autoIndex: false, // we manage indexes explicitly
  });

  console.log(MODE_WARNING.trim());
  const models = [
    { name: 'User', Model: User },
    { name: 'Asset', Model: Asset },
    { name: 'WorkOrder', Model: WorkOrder },
    { name: 'EquipmentTemplate', Model: EquipmentTemplate },
    // { name: 'Part', Model: Part },
    // { name: 'Procedure', Model: Procedure },
    // { name: 'Task', Model: Task },
  ].filter(Boolean);

  const run = MODE_FN[MODE] || MODE_FN.create;

  for (const { name, Model } of models) {
    const start = Date.now();
    try {
      await run(Model);
      const ms = Date.now() - start;
      console.log(`✅ ${name}: ${MODE_LABEL[MODE]} complete in ${ms} ms`);
    } catch (err) {
      console.error(`❌ ${name}: ${MODE_LABEL[MODE]} failed ->`, err.message);
    }
  }

  await mongoose.disconnect();
  console.log('[syncIndexes] Done.');
}

main().catch((e) => {
  console.error('[syncIndexes] Fatal:', e);
  process.exit(1);
});