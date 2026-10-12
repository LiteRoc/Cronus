// Native scheduler proof: captured cron, in-memory synthetic persistence only.
const assert = require('assert'), Module = require('module');
const {EventEmitter} = require('events');
const mongoose = require('mongoose');
mongoose.connect = mongoose.createConnection = () => {throw Error('Real persistence forbidden');};
const oid = n => new mongoose.Types.ObjectId(n.toString(16).padStart(24, '0'));
const facility = {_id: oid(1)}, template = {_id: oid(2), manufacturer: 'Synthetic', benchmark: {averageQuotedPrice: 100000}};
const assets = Array.from({length: 1001}, (_, i) => ({
  _id: oid(i + 10), facilityId: facility._id, templateId: template._id, status: 'Active',
  serviceStartDate: new Date('2000-01-01'),
  lifecyclePolicy: {sourceType: 'asset_override', expectedLifeYears: 5, reference: 'synthetic',
    approvedBy: oid(3), approvedAt: new Date('2025-01-01')}
}));
const sourceFacts = () => JSON.stringify(assets.map(({lifecycleCache, ...facts}) => facts));
const before = sourceFacts();
function query(input) {
  let rows = input;
  return {select(){return this;},sort(){return this;},limit(n){rows=rows.slice(0,n);return this;},
    lean(){return this;},then(yes,no){return Promise.resolve(rows).then(yes,no);},
    cursor(){return {async *[Symbol.asyncIterator](){yield* rows;}};}};
}
let writes=0, registrations=0, tick;
const filterAssets = filter => assets.filter(a => (!filter?._id?.$gt || String(a._id)>String(filter._id.$gt))
  && (!filter?._id?.$in || filter._id.$in.map(String).includes(String(a._id))));
const models = {
  Asset: {find: filter => query(filterAssets(filter)), exists: async filter => filterAssets(filter).length>0,
    collection:{updateOne: async (q,u) => {
      const a=assets.find(a=>String(a._id)===String(q._id));
      a.lifecycleCache=u.$set.lifecycleCache;writes++;return {matchedCount:1};
    }}},
  EquipmentTemplate:{find:()=>query([template])},
  Facility:{find:()=>query([facility]),findById:()=>query(facility)},
  Organization:{find:()=>query([])},WorkOrder:{find:()=>query([])}
};
const original=Module._load;
Module._load=function(request,parent,isMain) {
  if(request==='node-cron')return {schedule(){throw Error('Real cron forbidden');}};
  const match=request.match(/\/models\/([^/]+?)(?:\.js)?$/);
  if(match){assert(models[match[1]],'Unmocked model forbidden');return models[match[1]];}
  return original.apply(this,arguments);
};
(async()=>{
  try {
    process.env.CRON_ENABLED='false';
    const index=require('../index');
    assert.equal(typeof index.startLifecycleScheduling,'function');
    const scheduler=require('../lifecycleScheduler'), logs=[];
    const runner=scheduler.createLifecycleScheduler({
      flag:'true', connection:Object.assign(new EventEmitter(),{readyState:1}),log:entry=>logs.push(entry),
      schedule:(expression,callback,options)=>{
        assert.equal(expression,'*/15 * * * *');assert.equal(options.timezone,'UTC');
        assert.equal(options.runOnInit,false);tick=callback;registrations++;return {stop(){}};
      }
    });
    runner.start();assert.equal(registrations,1);assert.equal(writes,0);
    const first=tick();assert.equal((await tick()).state,'overlap_skipped');
    const a=await first;assert.equal(a.processed,1000);assert.equal(a.refreshed,1000);
    assert.equal(a.nextCursor,String(assets[999]._id));
    const b=await tick();assert.equal(b.processed,1);assert.equal(b.nextCursor,null);
    const c=await tick();assert.equal(c.processed,1000);assert.equal(c.skipped,1000);
    assert.equal(writes,1001);assert.equal(sourceFacts(),before);
    assert(logs.some(e=>e.event==='overlap_skip'));
    assert(logs.some(e=>e.event==='run_end' && e.previousCursor===a.nextCursor && e.fleetEnd));
    await runner.stop();
    console.log(JSON.stringify({nativeScheduler:'passed',registration:'captured',persistence:'mocked',
      firstConsidered:1000,secondConsidered:1,thirdSkippedFresh:1000,overlap:'skipped',sourceWrites:0}));
  } finally {Module._load=original;}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
