import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const requireCore=createRequire(new URL('../../../package.json',import.meta.url));
const m=requireCore('mongoose');
const actor='000000000000000000000001',facility='000000000000000000000002';
const secret='synthetic-reference-standalone';
let harness,app,P,M,W,O,mut,lifecycle,recovery;
jest.setTimeout(120000);
const headers=(role='technician')=>({Authorization:`Bearer ${jwt.sign({sub:actor,role,facilityId:facility,facilities:[facility]},secret,{issuer:'cronus.api',audience:'cronus.app'})}`});
const fields={partNumber:'Synthetic',description:'Synthetic',price:12,quantityOnHand:2};
const snapshot=async(Model,value)=>JSON.stringify(await Model.collection.findOne({_id:new m.Types.ObjectId(value)}));
const stored=(Model,value)=>Model.collection.findOne({_id:new m.Types.ObjectId(value)});
const send=(method,url,body,role='technician')=>request(app)[method](url).set(headers(role)).send(body);
const admin={id:actor,role:'admin'};
const inputFor=(Model,doc)=>({referenceModel:Model.modelName,referenceId:String(doc._id),token:doc.referenceReservation.token});
const quiescence=doc=>({token:doc.referenceReservation.token,writerInstanceId:doc.referenceReservation.writer.instanceId,
 writerStopped:true,databaseRequestsDrained:true,verifiedBy:actor,evidence:'Synthetic: originating callback finished; controlled failed write never dispatched'});
const native=()=>mut.createNative({facilityId:facility,assetId:new m.Types.ObjectId(),description:'Synthetic',createdBy:actor});
const archive=(kind,d)=>send('patch',`/${kind}/${d.id}/archive`,{},'admin');
async function uncertainCreate({committed=false}={}) {
 const manufacturer=await M.create({name:'Synthetic'});
 const save=P.prototype.save;
 jest.spyOn(P.prototype,'save').mockImplementationOnce(async function(...args){
  if(committed)await save.apply(this,args);
  throw Error('Synthetic uncertain write outcome');
 });
 await send('post','/parts',{...fields,manufacturerId:manufacturer.id}).expect(500);
 return stored(M,manufacturer.id);
}
beforeAll(async()=>{
 process.env.JWT_SECRET=secret;process.env.JWT_ISS='cronus.api';process.env.JWT_AUD='cronus.app';
 harness=await createIsolatedMongoHarness(m); // Intentionally standalone, not a replica set.
 P=requireCore('./src/models/Part');M=requireCore('./src/models/Manufacturer');W=requireCore('./src/models/WorkOrder');
 O=requireCore('./src/models/ReferenceOperation');
 mut=requireCore('./src/services/workOrderCosts/mutate');lifecycle=requireCore('./src/services/referenceLifecycle');recovery=requireCore('./src/services/referenceRecovery');
 app=express();app.use(express.json());app.use('/parts',requireCore('./src/routers/partRouter'));
 app.use('/manufacturers',requireCore('./src/routers/manufacturerRouter'));
 app.use('/workorders',requireCore('./src/routers/workOrderRouter'));
 await Promise.all([P.init(),M.init()]);
});
beforeEach(()=>{
 jest.spyOn(console,'log').mockImplementation(()=>{});
 jest.spyOn(m.connection,'transaction').mockImplementation(()=>{throw Error('Transactions forbidden in standalone regression');});
 jest.spyOn(m,'startSession').mockImplementation(()=>{throw Error('Sessions forbidden in standalone regression');});
});
afterEach(async()=>{jest.restoreAllMocks();if(harness)await Promise.all([P.deleteMany({}),M.deleteMany({}),W.deleteMany({}),O.deleteMany({})]);});
afterAll(async()=>{if(harness)await harness.stop();});

test('RESERVATION: standalone Part creation commits correlation, releases reservation, and keeps private fields private',async()=>{
 const manufacturer=await M.create({name:'Synthetic'}),before=await stored(M,manufacturer.id);
 const r=await send('post','/parts',{...fields,manufacturerId:manufacturer.id}).expect(201);
 expect(r.body.part).not.toHaveProperty('referenceReceipt');
 const p=await stored(P,r.body.part._id),after=await stored(M,manufacturer.id);
 expect(p.referenceReceipt).toBeUndefined();expect(p.referenceFence).toBeTruthy();
 expect(await O.collection.findOne({_id:p.referenceFence})).toMatchObject({state:'released',outcome:'committed',referenceModel:'Manufacturer'});
 expect(after.referenceReservation).toBeUndefined();expect(after.updatedAt).toEqual(before.updatedAt);expect(after.updatedBy).toEqual(before.updatedBy);
 expect((await send('get','/parts').expect(200)).body[0]).not.toHaveProperty('referenceReceipt');
});
test('RESERVATION: standalone usage commits correlation without changing price/snapshot behavior',async()=>{
 const p=await P.create(fields),before=await stored(P,p.id),w=await native();
 await send('post',`/workorders/${w.id}/parts`,{partId:p.id,quantity:2}).expect(201);
 const wo=await stored(W,w.id),after=await stored(P,p.id);
 expect(wo.referenceReceipt).toBeUndefined();expect(await O.collection.findOne({_id:wo.referenceFence})).toMatchObject({state:'released',outcome:'committed',referenceModel:'Part'});
 expect(wo.partsUsed[0]).toMatchObject({unitCost:12,extendedCost:24});
 expect(wo.partsUsed[0].pricing.sourceRevision).toBe(before.updatedAt.toISOString());
 expect(after.referenceReservation).toBeUndefined();expect(after.updatedAt).toEqual(before.updatedAt);expect(after.price).toBe(before.price);
});
test('RESERVATION: Manufacturer archive wins before atomic acquisition; Part creation fails',async()=>{
 const manufacturer=await M.create({name:'Synthetic'}),acquire=lifecycle.acquire;
 jest.spyOn(lifecycle,'acquire').mockImplementationOnce(async(...args)=>{await archive('manufacturers',manufacturer).expect(200);return acquire(...args);});
 await send('post','/parts',{...fields,manufacturerId:manufacturer.id}).expect(409);
 expect(await P.countDocuments()).toBe(0);
});
test('RESERVATION: Part archive wins before acquisition; usage/costs remain unchanged',async()=>{
 const p=await P.create(fields),w=await native(),before=await snapshot(W,w.id),acquire=lifecycle.acquire;
 jest.spyOn(lifecycle,'acquire').mockImplementationOnce(async(...args)=>{await archive('parts',p).expect(200);return acquire(...args);});
 await send('post',`/workorders/${w.id}/parts`,{partId:p.id,quantity:2}).expect(404);
 expect(await snapshot(W,w.id)).toBe(before);
});
test('RESERVATION: Manufacturer reservation blocks archive and competing reference creation with 409',async()=>{
 const manufacturer=await M.create({name:'Synthetic'}),save=P.prototype.save;
 jest.spyOn(P.prototype,'save').mockImplementationOnce(async function(...args){
  await archive('manufacturers',manufacturer).expect(409);
  await send('post','/parts',{...fields,partNumber:'Competing',manufacturerId:manufacturer.id}).expect(409);
  await send('put',`/manufacturers/${manufacturer.id}`,{name:'Changed'}).expect(409);
  const listed=await send('get','/manufacturers').expect(200);expect(listed.body[0]).not.toHaveProperty('referenceReservation');
  return save.apply(this,args);
 });
 await send('post','/parts',{...fields,manufacturerId:manufacturer.id}).expect(201);
 await archive('manufacturers',manufacturer).expect(200);
});
test('RESERVATION: Part reservation blocks archive and competing usage until WorkOrder persistence',async()=>{
 const p=await P.create(fields),w=await native(),write=W.collection.findOneAndUpdate.bind(W.collection);
 jest.spyOn(W.collection,'findOneAndUpdate').mockImplementationOnce(async(...args)=>{
  await archive('parts',p).expect(409);
  await send('post',`/workorders/${w.id}/parts`,{partId:p.id,quantity:1}).expect(409);
  await send('put',`/parts/${p.id}`,{price:90}).expect(409);
  return write(...args);
 });
 await send('post',`/workorders/${w.id}/parts`,{partId:p.id,quantity:2}).expect(201);
 await archive('parts',p).expect(200);
 const rows=await send('get',`/workorders/${w.id}/parts`).expect(200);expect(rows.body[0].partId._id).toBe(p.id);
});
test('RESERVATION: unknown write outcome retains token, even when destination appears absent',async()=>{
 const d=await uncertainCreate();expect(d.referenceReservation.token).toBeTruthy();expect(await P.countDocuments()).toBe(0);
 await archive('manufacturers',{id:String(d._id)}).expect(409);
 const plan=await recovery.recover(inputFor(M,d));expect(plan.outcome).toBe('not-observed');
 await expect(recovery.recover({...inputFor(M,d),action:'release-committed',actor:admin,reason:'Synthetic'})).rejects.toMatchObject({status:409});
});
test('RESERVATION: acquisition time is diagnostic; no TTL or age-based release',async()=>{
 const d=await uncertainCreate();
 await M.collection.updateOne({_id:d._id},{$set:{'referenceReservation.acquiredAt':new Date('1900-01-01')}});
 for(const Model of [P,M,O])expect(Model.schema.indexes().some(([,options])=>options.expireAfterSeconds!==undefined)).toBe(false);
 await archive('manufacturers',{id:String(d._id)}).expect(409);
 const plan=await recovery.recover(inputFor(M,d));expect(plan.outcome).toBe('not-observed');
 expect((await stored(M,d._id)).referenceReservation.token).toBe(d.referenceReservation.token);
});
test('RECOVERY: preview is read-only; committed correlated Part permits exact-token audited release and repeat',async()=>{
 const d=await uncertainCreate({committed:true}),input=inputFor(M,d),before=await snapshot(M,d._id);
 expect((await recovery.recover(input)).outcome).toBe('committed');expect(await snapshot(M,d._id)).toBe(before);
 const result=await recovery.recover({...input,action:'release-committed',actor:admin,reason:'Synthetic verified receipt'});
 expect(result.outcome).toBe('recovered');const after=await stored(M,d._id);
 expect(after.referenceReservation).toBeUndefined();expect(after.referenceRecoveryHistory).toBeUndefined();
 expect((await O.collection.findOne({_id:input.token})).audit).toMatchObject({token:input.token,actorId:actor,action:'release-committed'});
 expect(after.updatedAt).toEqual(d.updatedAt);
 expect((await recovery.recover({...input,action:'release-committed',actor:admin,reason:'Repeat'})).outcome).toBe('already-recovered');
 expect(await O.countDocuments({_id:input.token})).toBe(1);
});
test('RECOVERY: committed Manufacturer update receipt survives a later unlink',async()=>{
 const manufacturer=await M.create({name:'Synthetic'}),p=await P.create(fields);
 jest.spyOn(lifecycle,'release').mockRejectedValueOnce(Error('Synthetic lost cleanup'));
 await send('put',`/parts/${p.id}`,{manufacturerId:manufacturer.id}).expect(500);
 await send('put',`/parts/${p.id}`,{manufacturerId:null}).expect(200);
 const d=await stored(M,manufacturer.id),input=inputFor(M,d);
 expect((await recovery.recover(input)).outcome).toBe('committed');
 await recovery.recover({...input,action:'release-committed',actor:admin,reason:'Receipt retained after unlink'});
 expect((await P.findById(p.id)).manufacturerId).toBeNull();
});
test('RECOVERY: committed WorkOrder receipt survives usage deletion; price history not rewritten',async()=>{
 const p=await P.create(fields),w=await native(),write=W.collection.findOneAndUpdate.bind(W.collection);
 jest.spyOn(W.collection,'findOneAndUpdate').mockImplementationOnce(async(...args)=>{await write(...args);throw Error('Synthetic lost acknowledgement');});
 await send('post',`/workorders/${w.id}/parts`,{partId:p.id,quantity:2}).expect(500);
 const wo=await stored(W,w.id),d=await stored(P,p.id),input=inputFor(P,d);
 expect(wo.partsUsed[0]).toMatchObject({unitCost:12,extendedCost:24});
 await send('delete',`/workorders/${w.id}/part-usages/${wo.partsUsed[0]._id}`).expect(200);
 expect((await recovery.recover(input)).outcome).toBe('committed');
 await recovery.recover({...input,action:'release-committed',actor:admin,reason:'Synthetic committed usage receipt'});
 expect((await stored(P,p.id)).referenceReservation).toBeUndefined();
});
test('RECOVERY: absent destination cannot be abandoned without exact-token quiescence evidence',async()=>{
 const d=await uncertainCreate(),input=inputFor(M,d),before=await snapshot(M,d._id);
 for(const evidence of [undefined,{}, {...quiescence(d),writerStopped:false}, {...quiescence(d),databaseRequestsDrained:false}, {...quiescence(d),token:'wrong'}]){
  await expect(recovery.recover({...input,action:'abandon',actor:admin,reason:'Synthetic',quiescence:evidence})).rejects.toMatchObject({status:409});
  expect(await snapshot(M,d._id)).toBe(before);
 }
});
test('RECOVERY: explicitly verified stopped/drained absent operation can be abandoned, audited and retried safely',async()=>{
 const d=await uncertainCreate(),input=inputFor(M,d);
 // The controlled callback has finished and never dispatched its save. This
 // test supplies the operational evidence required by the offline runbook.
 const r=await recovery.recover({...input,action:'abandon',actor:admin,reason:'Verified synthetic writer ended',quiescence:quiescence(d)});
 expect(r.outcome).toBe('recovered');expect((await stored(M,d._id)).referenceReservation).toBeUndefined();
 expect(r.audit.quiescence.databaseRequestsDrained).toBe(true);
 expect((await recovery.recover({...input,action:'abandon',actor:admin,reason:'Repeat'})).outcome).toBe('already-recovered');
 await archive('manufacturers',{id:String(d._id)}).expect(200);
});
test('RECOVERY: active local writer cannot be abandoned even with a false quiescence assertion',async()=>{
 const manufacturer=await M.create({name:'Synthetic'}),save=P.prototype.save;
 jest.spyOn(P.prototype,'save').mockImplementationOnce(async function(...args){
  const d=await stored(M,manufacturer.id);
  await expect(recovery.recover({...inputFor(M,d),action:'abandon',actor:admin,reason:'Must refuse',quiescence:quiescence(d)})).rejects.toMatchObject({status:409});
  return save.apply(this,args);
 });
 await send('post','/parts',{...fields,manufacturerId:manufacturer.id}).expect(201);
});
test('RECOVERY: wrong token and non-admin apply never clear reservation',async()=>{
 const d=await uncertainCreate({committed:true}),input=inputFor(M,d),before=await snapshot(M,d._id);
 await expect(recovery.recover({...input,token:'11111111-1111-1111-1111-111111111111',action:'release-committed',actor:admin,reason:'Wrong'})).rejects.toMatchObject({status:409});
 await expect(recovery.recover({...input,action:'release-committed',actor:{id:actor,role:'technician'},reason:'Wrong'})).rejects.toMatchObject({status:403});
 expect(await snapshot(M,d._id)).toBe(before);
});
test('RECOVERY: completed old token cannot clear a newer reservation',async()=>{
 const d=await uncertainCreate({committed:true}),input=inputFor(M,d);
 await recovery.recover({...input,action:'release-committed',actor:admin,reason:'Old completed'});
 const newer=await lifecycle.acquire(M,String(d._id),'part-create',String(new m.Types.ObjectId()));
 expect((await recovery.recover({...input,action:'release-committed',actor:admin,reason:'Repeat'})).outcome).toBe('already-recovered');
 expect((await stored(M,d._id)).referenceReservation.token).toBe(newer.reservation.token);
});
test('RECOVERY: matching-token CAS cannot clear a replacement occurring after preview',async()=>{
 const d=await uncertainCreate({committed:true}),input=inputFor(M,d),release=lifecycle.release;
 const replacement='22222222-2222-2222-2222-222222222222';
 jest.spyOn(lifecycle,'release').mockImplementationOnce(async(...args)=>{
  await M.collection.updateOne({_id:d._id},{$set:{'referenceReservation.token':replacement}});
  return release(...args);
 });
 expect((await recovery.recover({...input,action:'release-committed',actor:admin,reason:'Race'})).outcome).toBe('recovered');
 const after=await stored(M,d._id);expect(after.referenceReservation.token).toBe(replacement);expect(after.referenceRecoveryHistory).toBeUndefined();
});
test('RECOVERY: unavailable destination lookup retains reservation without audit mutation',async()=>{
 const d=await uncertainCreate(),input=inputFor(M,d),before=await snapshot(M,d._id);
 jest.spyOn(P.collection,'findOne').mockRejectedValueOnce(Error('Synthetic read unavailable'));
 await expect(recovery.recover({...input,action:'release-committed',actor:admin,reason:'Unknown'})).rejects.toThrow('Synthetic read unavailable');
 expect(await snapshot(M,d._id)).toBe(before);
});
test('RESERVATION: definite validation failure releases instead of leaving an unnecessary lock',async()=>{
 const manufacturer=await M.create({name:'Synthetic'}),p=await P.create(fields);
 await send('put',`/parts/${p.id}`,{manufacturerId:manufacturer.id,price:'bad'}).expect(400);
 expect((await stored(M,manufacturer.id)).referenceReservation).toBeUndefined();expect((await P.findById(p.id)).manufacturerId).toBeUndefined();
});
test('RESERVATION: malformed partial reservation fails closed for acquisition/archive/recovery',async()=>{
 const manufacturer=await M.create({name:'Synthetic'});
 await M.collection.updateOne({_id:manufacturer._id},{$set:{referenceReservation:{token:'33333333-3333-3333-3333-333333333333'}}});
 await archive('manufacturers',manufacturer).expect(409);
 await send('post','/parts',{...fields,manufacturerId:manufacturer.id}).expect(409);
 const d=await stored(M,manufacturer.id);expect((await recovery.recover(inputFor(M,d))).outcome).toBe('uncertain');
});

test('RECOVERY: lost acquisition acknowledgement is discoverable by read-only preview without knowing token',async()=>{
 const manufacturer=await M.create({name:'Synthetic'}),write=M.findOneAndUpdate.bind(M);
 jest.spyOn(M,'findOneAndUpdate').mockImplementationOnce((...args)=>({lean:async()=>{
  await write(...args).lean();throw Error('Synthetic lost acquisition acknowledgement');
 }}));
 await send('post','/parts',{...fields,manufacturerId:manufacturer.id}).expect(500);
 const before=await snapshot(M,manufacturer.id);
 const plan=await recovery.recover({referenceModel:'Manufacturer',referenceId:manufacturer.id});
 expect(plan.outcome).toBe('not-observed');expect(plan.token).toBeTruthy();expect(plan.reservation.destinationId).toBeTruthy();
 expect(await snapshot(M,manufacturer.id)).toBe(before);expect(await P.countDocuments()).toBe(0);
 await expect(recovery.recover({referenceModel:'Manufacturer',referenceId:manufacturer.id,action:'abandon',actor:admin,reason:'No token'})).rejects.toMatchObject({status:400});
});
test('RECOVERY: positive commit evidence must match token, operation and reference identity',async()=>{
 const d=await uncertainCreate(),input=inputFor(M,d),r=d.referenceReservation;
 await P.collection.insertOne({...fields,_id:r.destinationId,referenceReceipt:{token:r.token,operation:r.operation,referenceModel:'Manufacturer',referenceId:new m.Types.ObjectId()}});
 expect((await recovery.recover(input)).outcome).toBe('not-observed');
 await expect(recovery.recover({...input,action:'release-committed',actor:admin,reason:'Wrong correlation'})).rejects.toMatchObject({status:409});
 expect((await stored(M,d._id)).referenceReservation.token).toBe(r.token);
});

test('RETENTION: repeated Manufacturer bind/unlink keeps business metadata constant-sized',async()=>{
 const manufacturer=await M.create({name:'Synthetic'}),p=await P.create(fields);
 for(let i=0;i<12;i++){
  await send('put',`/parts/${p.id}`,{manufacturerId:manufacturer.id}).expect(200);
  await send('put',`/parts/${p.id}`,{manufacturerId:null}).expect(200);
  const row=await stored(P,p.id),source=await stored(M,manufacturer.id);
  expect(row.referenceReceipt).toBeUndefined();expect(row.referenceReceipts).toBeUndefined();
  expect(row.referenceFence).toHaveLength(36);expect(source.referenceReservation).toBeUndefined();
  expect(source.referenceRecoveryHistory).toBeUndefined();
 }
 expect(await O.countDocuments({state:'released',outcome:'committed'})).toBe(12);
});
test('RETENTION: repeated usage add/remove leaves only one fence on WorkOrder',async()=>{
 const p=await P.create(fields),w=await native();
 for(let i=0;i<12;i++){
  const r=await send('post',`/workorders/${w.id}/parts`,{partId:p.id,quantity:2}).expect(201);
  await send('delete',`/workorders/${w.id}/part-usages/${r.body.part._id}`).expect(200);
  const row=await stored(W,w.id);
  expect(row.partsUsed).toHaveLength(0);expect(row.referenceReceipt).toBeUndefined();
  expect(row.referenceReceipts).toBeUndefined();expect(row.referenceFence).toHaveLength(36);
  const api=await send('get','/workorders').expect(200);
  expect(JSON.stringify(api.body)).not.toContain(row.referenceFence);
 }
 expect(await O.countDocuments({state:'released'})).toBe(12);
});
test('RETENTION: old token cannot replay after receipt removal and later reference commits',async()=>{
 const manufacturer=await M.create({name:'Synthetic'}),p=await P.create(fields);
 const h=await lifecycle.acquire(M,manufacturer.id,'part-manufacturer-update',p.id);
 await lifecycle.updateActive(P,p.id,{manufacturerId:manufacturer._id},actor,h);
 await lifecycle.release(h);
 await send('put',`/parts/${p.id}`,{manufacturerId:null}).expect(200);
 await send('put',`/parts/${p.id}`,{manufacturerId:manufacturer.id}).expect(200);
 await send('put',`/parts/${p.id}`,{manufacturerId:null}).expect(200);
 const before=await snapshot(P,p.id);
 await expect(lifecycle.updateActive(P,p.id,{manufacturerId:manufacturer._id},actor,h)).rejects.toMatchObject({status:409});
 expect(await snapshot(P,p.id)).toBe(before);
});
test('RETENTION: old usage token cannot duplicate effects after successful cleanup',async()=>{
 const p=await P.create(fields),w=await native();
 const h=await lifecycle.acquire(P,p.id,'workorder-part-add',w.id);
 const write=()=>mut.mutate({_id:w.id},{id:actor},async next=>{
  const entry=await mut.part(next,{partId:p.id,quantity:2},{id:actor},h);next.partsUsed.push(entry);return entry;
 },h);
 await write();await lifecycle.release(h);
 const before=await snapshot(W,w.id);
 await expect(write()).rejects.toMatchObject({status:409});expect(await snapshot(W,w.id)).toBe(before);
});
test('RETENTION: failed ledger proof transfer retains receipt and reservation for recovery',async()=>{
 const manufacturer=await M.create({name:'Synthetic'});
 jest.spyOn(O.collection,'updateOne').mockRejectedValueOnce(Error('Synthetic journal failure'));
 await send('post','/parts',{...fields,manufacturerId:manufacturer.id}).expect(500);
 const d=await stored(M,manufacturer.id),input=inputFor(M,d);
 expect((await recovery.recover(input)).outcome).toBe('committed');
 const p=await P.collection.findOne({_id:d.referenceReservation.destinationId});expect(p.referenceReceipt.token).toBe(input.token);
 await recovery.recover({...input,action:'release-committed',actor:admin,reason:'Synthetic'});
 expect((await stored(P,p._id)).referenceReceipt).toBeUndefined();
});
test('RETENTION: journaled commit survives receipt cleanup interrupted before source release',async()=>{
 const manufacturer=await M.create({name:'Synthetic'});
 jest.spyOn(M,'updateOne').mockRejectedValueOnce(Error('Synthetic source release failure'));
 await send('post','/parts',{...fields,manufacturerId:manufacturer.id}).expect(500);
 const d=await stored(M,manufacturer.id),input=inputFor(M,d);
 expect((await stored(P,d.referenceReservation.destinationId)).referenceReceipt).toBeUndefined();
 expect((await recovery.recover(input)).outcome).toBe('committed');
 await recovery.recover({...input,action:'release-committed',actor:admin,reason:'Synthetic'});
 expect((await recovery.recover(input)).outcome).toBe('already-recovered');
 expect((await O.collection.findOne({_id:input.token})).audit.reason).toBe('Synthetic');
});
test('RETENTION: lost operation preparation acknowledgement remains recoverable without destination write',async()=>{
 const manufacturer=await M.create({name:'Synthetic'}),insert=O.collection.insertOne.bind(O.collection);
 jest.spyOn(O.collection,'insertOne').mockImplementationOnce(async(...args)=>{await insert(...args);throw Error('Synthetic lost preparation ack');});
 await send('post','/parts',{...fields,manufacturerId:manufacturer.id}).expect(500);
 const d=await stored(M,manufacturer.id),input=inputFor(M,d);
 expect(await P.countDocuments()).toBe(0);expect((await recovery.recover(input)).outcome).toBe('not-observed');
 await recovery.recover({...input,action:'abandon',actor:admin,reason:'Synthetic ended writer',quiescence:quiescence(d)});
 expect((await O.collection.findOne({_id:input.token})).outcome).toBe('absent');
});
test('RETENTION: recovery finishes a lost final acknowledgement after source release',async()=>{
 const manufacturer=await M.create({name:'Synthetic'}),update=O.collection.updateOne.bind(O.collection);
 jest.spyOn(O.collection,'updateOne').mockImplementation(async(...args)=>{
  if(args[1].$set?.state==='released')throw Error('Synthetic final journal unavailable');
  return update(...args);
 });
 await send('post','/parts',{...fields,manufacturerId:manufacturer.id}).expect(500);
 jest.restoreAllMocks();
 const op=await O.collection.findOne({referenceId:manufacturer._id});
 expect((await stored(M,manufacturer.id)).referenceReservation).toBeUndefined();
 const input={referenceModel:'Manufacturer',referenceId:manufacturer.id,token:op._id};
 expect((await recovery.recover(input)).outcome).toBe('committed');
 const newer=await lifecycle.acquire(M,manufacturer.id,'part-create',String(new m.Types.ObjectId()));
 await recovery.recover({...input,action:'release-committed',actor:admin,reason:'Synthetic resume cleanup'});
 expect((await stored(M,manufacturer.id)).referenceReservation.token).toBe(newer.reservation.token);
 expect((await recovery.recover(input)).outcome).toBe('already-recovered');
});
test('RETENTION: bounded recovery evidence rejects excessive text and never stores arbitrary fields',async()=>{
 const d=await uncertainCreate(),input=inputFor(M,d);
 await expect(recovery.recover({...input,action:'abandon',actor:admin,reason:'x'.repeat(1025),quiescence:quiescence(d)})).rejects.toMatchObject({status:400});
 await expect(recovery.recover({...input,action:'abandon',actor:admin,reason:'Synthetic',quiescence:{...quiescence(d),evidence:'x'.repeat(4097)}})).rejects.toMatchObject({status:409});
 await recovery.recover({...input,action:'abandon',actor:admin,reason:'Synthetic',quiescence:{...quiescence(d),extra:['Not persisted']}});
 expect((await O.collection.findOne({_id:input.token})).audit.quiescence).not.toHaveProperty('extra');
});
