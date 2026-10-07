// Native module execution, NOT an application entrypoint. All persistence is mocked.
process.env.CRON_ENABLED='false';
const assert=require('assert'),Module=require('module'),mongoose=require('mongoose');
mongoose.connect=mongoose.createConnection=()=>{throw new Error('Real persistence forbidden');};
const oid=n=>new mongoose.Types.ObjectId(n.toString(16).padStart(24,'0'));
const facility={_id:oid(1)},template={_id:oid(2),manufacturer:'Synthetic',benchmark:{averageQuotedPrice:100000}};
const asset={_id:oid(3),facilityId:facility._id,templateId:template._id,status:'Active',serviceStartDate:new Date('2000-01-01'),lifecyclePolicy:{sourceType:'asset_override',expectedLifeYears:5,reference:'synthetic',approvedBy:oid(4),approvedAt:new Date('2025-01-01')}};
function query(input){let rows=input;return {select(){return this},sort(){return this},limit(n){rows=rows.slice(0,n);return this},lean(){return this},then(yes,no){return Promise.resolve(rows).then(yes,no)},cursor(){return {async *[Symbol.asyncIterator](){yield*rows;}}}};}
const models={Asset:{find:filter=>query(filter?._id?.$gt?[]:[{...asset}]),exists:async()=>null,collection:{updateOne:async(_q,u)=>{asset.lifecycleCache=u.$set.lifecycleCache;return {matchedCount:1}}}},EquipmentTemplate:{find:()=>query([template])},Facility:{find:()=>query([facility]),findById:()=>query(facility)},Organization:{find:()=>query([])},WorkOrder:{find:()=>query([])}};
const original=Module._load;
Module._load=function(request,parent,isMain){if(request==='node-cron')return {schedule(){throw new Error('Scheduling forbidden in native probe');}};const match=request.match(/\/models\/([^/]+?)(?:\.js)?$/);if(match){assert(models[match[1]],'Unmocked model forbidden');return models[match[1]];}return original.apply(this,arguments);};
(async()=>{try{const scheduler=require('../lifecycleScheduler');const result=await scheduler.refreshLifecycleCaches({maxAssets:1});assert.equal(result.refreshed,1);assert.equal(asset.lifecycleCache.assessment.replacementAssessment.state,'recommended');assert.equal(asset.lifecycleCache.assessment.capital.replacementValue.amount,100000);console.log(JSON.stringify({nativeModuleExecution:'passed',refreshed:1,scheduling:'forbidden',persistence:'mocked'}));}finally{Module._load=original;}})().catch(error=>{console.error(error.message);process.exitCode=1;});
