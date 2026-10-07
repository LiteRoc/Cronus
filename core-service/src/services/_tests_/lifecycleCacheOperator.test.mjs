import {createRequire} from 'node:module';
import {jest} from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createIsolatedMongoHarness} from '../../test/mongoMemoryHarness.mjs';
const require = createRequire(import.meta.url), m = require('mongoose');
const operator = require('../lifecycleCacheOperator'), cache = require('../lifecycleCache');
const {assessAssets} = require('../assetLifecycleAssessmentBatch');
const {parseArgs, main} = require('../../scripts/refreshLifecycleCache');
const {TEMPLATE_FIELDS, populatedLifecycleTemplate} = require('../lifecycleTemplateShape');
const id = n => n.toString(16).padStart(24, '0');
const fid = id(1), other = id(2), actor = id(3), tid = id(4), oid = id(5);
let h, A, T, F, O, W, U, C;
const options = extra => ({mode: 'preview', facilityId: fid, actorId: actor, maxAssets: 5, pageSize: 2, ...extra});
const run = (extra, hooks) => operator.runLifecycleCacheOperator(options(extra), hooks);
async function seed(n = 10, extra = {}) {
  const a = {_id: new m.Types.ObjectId(id(n)), facilityId: new m.Types.ObjectId(fid), templateId: new m.Types.ObjectId(tid),
    status: 'Active', manufacturer: 'Synthetic', model: 'Pump', serviceStartDate: new Date('2010-01-01'), ...extra};
  await A.collection.insertOne(a); return a;
}
const raw = async Model => cache.digest(await Model.collection.find({}).sort({_id: 1}).toArray());
const assetFacts = async () => cache.digest((await A.collection.find({}).sort({_id: 1}).toArray()).map(({lifecycleCache, ...facts}) => facts));
async function fresh(a) {return cache.materializePage([await A.findById(a._id).lean()]);}
const policy = extra => ({templateId: new m.Types.ObjectId(tid), sourceType: 'organization_policy', expectedLifeYears: 6,
  approvedBy: new m.Types.ObjectId(actor), approvedAt: new Date('2025-01-01'), reference: 'synthetic-approved', ...extra});
jest.setTimeout(120000);
beforeAll(async () => {
  process.env.NODE_ENV = 'test'; process.env.CRON_ENABLED = 'false'; m.set('autoIndex', false); m.set('autoCreate', false);
  h = await createIsolatedMongoHarness(m);
  A = require('../../models/Asset'); T = require('../../models/EquipmentTemplate'); F = require('../../models/Facility');
  O = require('../../models/Organization'); W = require('../../models/WorkOrder'); U = require('../../models/User');
  C = m.connection.collection('contracts');
});
beforeEach(async () => {
  await F.collection.insertMany([{_id: new m.Types.ObjectId(fid), organizationId: new m.Types.ObjectId(oid)}, {_id: new m.Types.ObjectId(other)}]);
  await U.collection.insertOne({_id: new m.Types.ObjectId(actor), role: 'admin', facilities: [new m.Types.ObjectId(fid)]});
  await O.collection.insertOne({_id: new m.Types.ObjectId(oid), lifecyclePolicies: []});
  await T.collection.insertOne({_id: new m.Types.ObjectId(tid), manufacturer: 'Synthetic', model: 'Pump', category: 'Synthetic',
    lifecycleDefaults: {expectedLifeYears: 8}, benchmark: {averageQuotedPrice: 5000, source: 'synthetic', reportDate: new Date('2025-01-01'), confidence: 'high'}});
});
afterEach(async () => {jest.restoreAllMocks(); if (h) {await Promise.all([A,T,F,O,W,U].map(Model => Model.deleteMany({}))); await C.deleteMany({});}});
afterAll(async () => {if (h) await h.stop();});
test('test persistence fails closed', async () => {await expect(m.connect(process.env.MONGO_URI)).rejects.toThrow('not issued');});
test.each([false, true])('live populated and materialized canonical parity, Organization policy=%s', async approved => {
  if (approved) await O.collection.updateOne({_id: new m.Types.ObjectId(oid)}, {$set: {lifecyclePolicies: [policy()]}});
  const a = await seed(), asOf = new Date();
  const live = await A.findById(a._id).populate('templateId').lean();
  const evidence = (await cache.dependencies([a], {asOf})).get(String(a._id));
  // Permanent guard on the actual dependency projection, not a manually built fixture.
  expect(Object.keys(evidence.asset.templateId)).toEqual(expect.arrayContaining(['_id','manufacturer','benchmark','lifecycleDefaults']));
  const normal = (await assessAssets([live], {asOf})).get(String(a._id));
  const material = (await assessAssets([evidence.asset], {asOf})).get(String(a._id));
  expect(material.assessment).toEqual(normal.assessment);
  expect(material.assessment.expectedLife).toMatchObject({years: approved ? 6 : 8, status: approved ? 'resolved' : 'provisional'});
  expect(material.assessment.capital.replacementValue).toMatchObject({amount: 5000, currency: null, status: 'estimated', source: {reference: 'synthetic'}});
  expect(await fresh(a)).toEqual(new Map([[String(a._id), 'refreshed']]));
  // Run writer at identical asOf for full canonical object comparison.
  await A.collection.updateOne({_id: a._id}, {$unset: {lifecycleCache: ''}});
  await cache.materializePage([a], {asOf});
  const saved = await A.findById(a._id).lean();
  expect(saved.lifecycleCache.assessment).toEqual(normal.assessment);
  expect(cache.freshness(saved, evidence, new Date()).state).toBe('fresh');
  saved.lifecycleCache.assessment.capital.replacementValue.amount = 999;
  expect(cache.freshness(saved, evidence, new Date()).state).toBe('unsupported');
});
test.each(['lifecycleDefaults','eolYears','benchmark'])('every Template lifecycle evidence branch projected: %s', async field => {
  const shape = {lifecycleDefaults: {expectedLifeYears: 8}, eolYears: 9, benchmark: {expectedUsefulLifeYears: 10, averageListPrice: 5000}};
  await T.collection.replaceOne({_id: new m.Types.ObjectId(tid)}, {_id: new m.Types.ObjectId(tid), manufacturer:'Synthetic', [field]: shape[field]});
  const a = await seed(), asOf = new Date();
  const live = (await assessAssets([await A.findById(a._id).populate('templateId').lean()], {asOf})).get(String(a._id));
  const deps = (await cache.dependencies([a], {asOf})).get(String(a._id));
  expect(deps.asset.templateId[field]).toEqual(shape[field]);
  expect((await assessAssets([deps.asset], {asOf})).get(String(a._id)).assessment).toEqual(live.assessment);
});
test('Template recognition rejects bare IDs and accepts projected evidence without manufacturer', () => {
  for (const value of [tid, new m.Types.ObjectId(tid), {_id:tid}, {_id:'bad',benchmark:{}}]) expect(populatedLifecycleTemplate(value)).toBeNull();
  expect(populatedLifecycleTemplate({_id:tid,benchmark:{}})).not.toBeNull();
  expect(TEMPLATE_FIELDS).toEqual(['_id','manufacturer','benchmark','lifecycleDefaults','eolYears']);
});
test.each(['benchmark','lifecycleDefaults','eolYears','manufacturer'])('Template dependency changes invalidate fingerprint: %s', async field => {
  const a = await seed(); await fresh(a);
  const changes = {benchmark:{averageQuotedPrice:6000}, lifecycleDefaults:{expectedLifeYears:9}, eolYears:12, manufacturer:'Changed'};
  await T.collection.updateOne({_id:new m.Types.ObjectId(tid)},{$set:{[field]:changes[field]}});
  const stored = await A.findById(a._id).lean(), deps = (await cache.dependencies([stored])).get(String(a._id));
  expect(cache.freshness(stored,deps).state).toBe('stale');
});
test('one explicit Asset; duplicates normalized; exact multiple cohort never widens', async () => {
  for (let n=10;n<14;n++) await seed(n);
  expect((await run({assetIds:[id(11)]})).outcomes.map(r=>r.assetId)).toEqual([id(11)]);
  expect((await run({assetIds:[id(12),id(10),id(12)]})).outcomes.map(r=>r.assetId)).toEqual([id(10),id(12)]);
});
test.each([{assetIds:['bad']},{assetIds:[id(99)]},{assetIds:[id(10),id(11)]}])('invalid exact pilot rejects before any write: %j', async extra => {
  await seed(10); await seed(11,{facilityId:new m.Types.ObjectId(other)});
  const before=await raw(A); await expect(run({mode:'apply',...extra})).rejects.toThrow(); expect(await raw(A)).toBe(before);
});
test.each([{isArchived:true},{deletedAt:new Date()}])('ineligible explicit selection rejects: %j', async extra => {
  await seed(10,extra); await expect(run({mode:'apply',assetIds:[id(10)]})).rejects.toThrow('selection unavailable');
});
test.each(['viewer','technician','customer'])('non-admin %s denied', async role => {
  await U.collection.updateOne({_id:new m.Types.ObjectId(actor)},{$set:{role}}); await expect(run()).rejects.toThrow('not authorized');
});
test('missing actor and unassigned Facility denied; assigned primary Facility accepted', async () => {
  await expect(run({actorId:id(99)})).rejects.toThrow('not authorized');
  await expect(run({facilityId:other})).rejects.toThrow('not authorized');
  await U.collection.updateOne({_id:new m.Types.ObjectId(actor)},{$set:{facilities:[],facilityId:new m.Types.ObjectId(fid)}});
  expect((await run()).state).toBe('completed');
});
test('missing Facility fails closed', async () => {await F.deleteMany({}); await expect(run()).rejects.toThrow('Facility unavailable');});
test('Facility traversal is bounded and cursor resumes only within Facility', async () => {
  for(let n=10;n<16;n++) await seed(n,n===12?{facilityId:new m.Types.ObjectId(other)}:{});
  const first=await run({maxAssets:2,pageSize:1}); expect(first.outcomes.map(r=>r.assetId)).toEqual([id(10),id(11)]); expect(first.nextCursor).toBe(id(11));
  const rest=await run({maxAssets:3,afterId:first.nextCursor}); expect(rest.outcomes.map(r=>r.assetId)).toEqual([id(13),id(14),id(15)]); expect(rest.nextCursor).toBeNull();
});
test('preview reports missing/stale/fresh/unsupported/expired with zero writes', async () => {
  const assets=[];for(let n=10;n<15;n++) assets.push(await seed(n));
  await fresh(assets[1]); await fresh(assets[4]);
  await A.collection.updateOne({_id:assets[2]._id},{$set:{metrics:{computedAt:new Date()}}});
  await A.collection.updateOne({_id:assets[3]._id},{$set:{lifecycleCache:{schemaVersion:'old'}}});
  await A.collection.updateOne({_id:assets[4]._id},{$set:{'lifecycleCache.validUntil':new Date('2000-01-01').toISOString()}});
  const before=await raw(A), spy=jest.spyOn(A.collection,'updateOne');
  const preview=await run({assetIds:assets.map(a=>String(a._id))});
  expect(preview.outcomes.map(r=>r.cacheState)).toEqual(['missing','fresh','stale','unsupported','stale']);
  expect(preview.outcomes[1]).toMatchObject({wouldAttempt:false,skipReason:'fresh'});expect(preview.outcomes[4].cacheReason).toBe('expired');
  expect(spy).not.toHaveBeenCalled();expect(await raw(A)).toBe(before);
});
test('synthetic five-Asset pilot reconciles; sixth and all source collections unchanged', async () => {
  const assets=[];for(let n=10;n<16;n++) assets.push(await seed(n));
  await fresh(assets[1]);await fresh(assets[3]);
  await W.collection.insertOne({assetId:assets[0]._id,facilityId:new m.Types.ObjectId(fid),status:'Completed',completionDate:new Date(),economics:{schemaVersion:1,origin:'native',revision:1},timeLogs:[],partsUsed:[],travelLogs:[]});
  await C.insertOne({_id:new m.Types.ObjectId(id(99)),synthetic:true});
  const before={assets:await assetFacts(),workOrders:await raw(W),templates:await raw(T),organizations:await raw(O),contracts:await raw({collection:C})};
  const sixth=cache.digest(await A.collection.findOne({_id:assets[5]._id}));
  const ids=assets.slice(0,5).map(a=>String(a._id)), writes=jest.spyOn(A.collection,'updateOne');
  const preview=await run({assetIds:ids});expect(preview.selected).toBe(5);expect(writes).not.toHaveBeenCalled();
  const applied=await run({mode:'apply',assetIds:ids});
  expect(applied).toMatchObject({selected:5,considered:5,refreshed:3,skippedFresh:2,failed:0,conflicted:0,expired:0,state:'completed'});
  expect(applied.outcomes.map(r=>r.assetId)).toEqual(preview.outcomes.map(r=>r.assetId));
  for(const [,update] of writes.mock.calls) expect(Object.keys(update.$set)).toEqual(['lifecycleCache']);
  expect(await assetFacts()).toBe(before.assets);expect(await raw(W)).toBe(before.workOrders);expect(await raw(T)).toBe(before.templates);expect(await raw(O)).toBe(before.organizations);expect(await raw({collection:C})).toBe(before.contracts);
  expect(cache.digest(await A.collection.findOne({_id:assets[5]._id}))).toBe(sixth);
  const proof={preview,apply:applied,previewWrites:0,sourceFactsUnchanged:true,sixthUnchanged:true};
  if(process.env.CRONUS_22_PROOF_FILE) fs.writeFileSync(process.env.CRONUS_22_PROOF_FILE,JSON.stringify(proof,null,2));
});
test.each(['asset','template','policy','workOrder'])('changed dependency during apply reports conflict: %s', async kind => {
  const a=await seed();const result=await run({mode:'apply',assetIds:[id(10)]},{beforePersist:async()=>{
    if(kind==='asset')await A.collection.updateOne({_id:a._id},{$set:{serviceStartDate:new Date('2020-01-01')}});
    if(kind==='template')await T.collection.updateOne({_id:new m.Types.ObjectId(tid)},{$set:{eolYears:10}});
    if(kind==='policy')await O.collection.updateOne({_id:new m.Types.ObjectId(oid)},{$set:{lifecyclePolicies:[policy()]}});
    if(kind==='workOrder')await W.collection.insertOne({assetId:a._id,facilityId:new m.Types.ObjectId(fid),status:'Completed'});
  }});expect(result).toMatchObject({conflicted:1,refreshed:0,state:'incomplete'});expect((await A.findById(a._id).lean()).lifecycleCache).toBeUndefined();
});
test('older calculation cannot replace newer materialization', async () => {
  const a=await seed();let newer;
  const result=await run({mode:'apply',assetIds:[id(10)]},{beforePersist:async()=>{
    await cache.materializePage([await A.findById(a._id).lean()]);newer=(await A.findById(a._id).lean()).lifecycleCache;
  }});expect(result.conflicted).toBe(1);expect((await A.findById(a._id).lean()).lifecycleCache).toEqual(newer);
});
test('an explicitly older asOf cannot replace an already observed newer supported cache',async()=>{
  const a=await seed();await fresh(a);const stored=await A.findById(a._id).lean();
  const older=new Date(Date.parse(stored.lifecycleCache.assessmentAsOf)-1000);
  expect(await cache.materializePage([stored],{asOf:older})).toEqual(new Map([[id(10),'conflict']]));
  expect((await A.findById(a._id).lean()).lifecycleCache).toEqual(stored.lifecycleCache);
});
test('unsupported future metadata cannot block correction of an invalid envelope',async()=>{
  const a=await seed();await A.collection.updateOne({_id:a._id},{$set:{lifecycleCache:{schemaVersion:cache.SCHEMA,calculationVersion:cache.CALCULATION,assessmentAsOf:'2999-01-01T00:00:00Z',policyVersion:'old'}}});
  expect(await run({mode:'apply',assetIds:[id(10)]})).toMatchObject({refreshed:1,conflicted:0,state:'completed'});
});
test('CAS failure is a conflict', async () => {await seed();jest.spyOn(A.collection,'updateOne').mockResolvedValueOnce({matchedCount:0});expect((await run({mode:'apply',assetIds:[id(10)]})).conflicted).toBe(1);});
test('database write failure is a failed record', async () => {await seed();jest.spyOn(A.collection,'updateOne').mockRejectedValueOnce(Error('synthetic DB failure'));expect((await run({mode:'apply',assetIds:[id(10)]}))).toMatchObject({failed:1,state:'incomplete'});});
test('canonical assessment unavailable is failed, never fallback', async () => {await seed();jest.spyOn(require('../lifecycleMaintenance').default,'getMaintenanceTotalsBatch').mockRejectedValueOnce(Error('synthetic'));expect((await run({mode:'apply',assetIds:[id(10)]}))).toMatchObject({failed:1,refreshed:0});});
test('expired calculation requires retry', async () => {await seed();expect((await run({mode:'apply',assetIds:[id(10)]},{asOf:new Date('2001-01-01')}))).toMatchObject({expired:1,refreshed:0,state:'incomplete'});});
test('invalid facts after preview fail apply without forcing preview', async () => {await seed();expect((await run({assetIds:[id(10)]})).selected).toBe(1);await A.collection.updateOne({_id:new m.Types.ObjectId(id(10))},{$set:{isArchived:true}});await expect(run({mode:'apply',assetIds:[id(10)]})).rejects.toThrow('selection unavailable');});
test.each([{maxAssets:0},{maxAssets:10001},{maxAssets:1.5},{pageSize:0},{pageSize:251},{pageSize:1.5},{facilityId:undefined},{facilityId:'bad'},{actorId:'bad'},{assetIds:[id(10),id(11)],maxAssets:1},{assetIds:[id(10)],afterId:id(9)},{afterId:'bad'}])('bounds/scope rejected: %j', extra=>{expect(()=>operator.validateOptions(options(extra))).toThrow();});
test('CLI validates flags and refuses apply approval before connecting',async()=>{
  const base=['--facility-id',fid,'--actor-id',actor,'--max-assets','5','--output','synthetic.json'];
  expect(parseArgs([...base,'--asset-id',id(10),'--asset-id',id(10)])).toMatchObject({mode:'preview',assetIds:[id(10)]});
  for(const args of [[...base,'--wat'],[...base,'--max-assets','5'],[...base,'--apply','--preview'],['--apply']])expect(()=>parseArgs(args)).toThrow();
  delete process.env.CRONUS_APPROVED_LIFECYCLE_REFRESH;
  const connect=jest.spyOn(m,'connect');await expect(main([...base,'--apply'])).rejects.toThrow('approval');expect(connect).not.toHaveBeenCalled();
});
test('manual help and service remain independent of scheduler',async()=>{
  const log=jest.spyOn(console,'log').mockImplementation(()=>{});await main(['--help']);expect(log).toHaveBeenCalled();
  await seed();await run({mode:'apply',assetIds:[id(10)]});expect(process.env.CRON_ENABLED).toBe('false');
  expect(Object.keys(require.cache).filter(k=>/cronJobs|\/cron\.js$/.test(k))).toEqual([]);
});
test('CLI preview and apply produce structured output and nonzero failure status',async()=>{
  await seed();const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cronus-22-cli-'));
  // Keep the already-issued isolated connection; CLI connection/disconnection boundaries are mocked.
  jest.spyOn(m,'connect').mockResolvedValue(m);jest.spyOn(m,'disconnect').mockResolvedValue();
  const base=['--facility-id',fid,'--actor-id',actor,'--max-assets','5','--asset-id',id(10)];
  const before=await raw(A);await main([...base,'--output',path.join(dir,'preview.json')]);
  expect(await raw(A)).toBe(before);expect(JSON.parse(fs.readFileSync(path.join(dir,'preview.json'))).selected).toBe(1);
  process.env.CRONUS_APPROVED_LIFECYCLE_REFRESH='yes';
  await main([...base,'--apply','--output',path.join(dir,'apply.json')]);
  expect(JSON.parse(fs.readFileSync(path.join(dir,'apply.json')))).toMatchObject({refreshed:1,state:'completed'});
  const savedExit=process.exitCode;
  try {
    await main([...base,'--apply','--asset-id',id(99),'--output',path.join(dir,'rejected.json')]);
    expect(process.exitCode).toBe(1);expect(JSON.parse(fs.readFileSync(path.join(dir,'rejected.json'))).state).toBe('selection_rejected');
  } finally {process.exitCode=savedExit;delete process.env.CRONUS_APPROVED_LIFECYCLE_REFRESH;}
});
test('query failure after a completed page preserves outcomes and reports failure for remaining members',async()=>{
  await seed(10);await seed(11);const original=A.find.bind(A);let calls=0;
  jest.spyOn(A,'find').mockImplementation((...args)=>{
    calls++;
    // Two preflight pages, first engine page and its source recheck, then next engine page.
    if(calls===5)return {sort:()=>({limit:()=>({lean:async()=>{throw Error('synthetic query failure');}})})};
    return original(...args);
  });
  expect(await run({mode:'apply',assetIds:[id(10),id(11)],pageSize:1})).toMatchObject({considered:2,refreshed:1,failed:1,state:'incomplete'});
});
test('Asset moved out of Facility after selection is never written',async()=>{
  const a=await seed();const result=await run({mode:'apply',assetIds:[id(10)]},{beforePersist:async()=>{
    await A.collection.updateOne({_id:a._id},{$set:{facilityId:new m.Types.ObjectId(other)}});
  }});expect(result.conflicted).toBe(1);expect((await A.findById(a._id).lean()).lifecycleCache).toBeUndefined();
});
test('member removed after preflight is reported rather than silently skipped',async()=>{
  await seed(10);const second=await seed(11);let changed=false;
  const result=await run({mode:'apply',assetIds:[id(10),id(11)],pageSize:1},{beforePersist:async()=>{
    if(!changed){changed=true;await A.collection.updateOne({_id:second._id},{$set:{isArchived:true}});}
  }});
  expect(result).toMatchObject({selected:2,considered:2,refreshed:1,failed:1,state:'incomplete'});
  expect(result.outcomes[1].outcome).toBe('selection_changed');
});
