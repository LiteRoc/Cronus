import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const m = requireCore('mongoose');
const actor='000000000000000000000001', spoof='000000000000000000000002', facility='000000000000000000000003';
const old='2001-02-03T04:05:06.000Z', secret='synthetic-reference-lifecycle-regression';
let h, app, P, M, W, mut, routers, auth;
jest.setTimeout(120000);
const headers=(role='technician', context=true)=>({Authorization:`Bearer ${jwt.sign({sub:actor,role,...(context?{facilityId:facility,facilities:[facility]}:{})},secret,{issuer:'cronus.api',audience:'cronus.app',expiresIn:'10m'})}`});
const body=(kind,suffix='')=>kind==='parts'?{partNumber:`Synthetic${suffix}`,description:'Synthetic',price:12,quantityOnHand:2}:{name:`Synthetic${suffix}`};
const model=kind=>kind==='parts'?P:M;
const seed=kind=>model(kind).create({...body(kind),createdBy:actor});
const send=(method,url,data,role='technician')=>request(app)[method](url).set(headers(role)).send(data);
function registeredApplication(){
 const captured=express();captured.listen=()=>{};
 const fakeRequire=name=>{
  if(name==='express')return Object.assign(()=>captured,express);
  if(name==='path')return path;
  if(name==='process')return {title:'synthetic'};
  if(name==='dotenv')return {config(){}};
  if(name==='debug')return ()=>()=>{};
  if(routers[name])return routers[name];
  if(name==='./src/middleware/authMiddleware')return auth;
  if(name==='./src/middleware/forwardContractHeaders')return {attachContractClient:(_q,_s,n)=>n()};
  if(name.includes('/routers/')){const r=express.Router();r.vendorJsonErrorHandler=r.supplierJsonErrorHandler=r.contactJsonErrorHandler=r.followUpJsonErrorHandler=(_q,_s,n)=>n();return r;}
  if(name.includes('/models/'))return {};
  if(name==='./src/config/db')return ()=>{};
  if(name==='./src/cronJobs/index')return {};
  if(['morgan','cors'].includes(name))return ()=> (_q,_s,n)=>n();
  if(name==='express-ejs-layouts')return (_q,_s,n)=>n();
  throw Error(`Unexpected startup dependency ${name}`);
 };
 vm.runInNewContext(readFileSync(new URL('../../../app.js',import.meta.url),'utf8'),{require:fakeRequire,__dirname:'/synthetic-no-public-files',process:{env:{}},console:{log(){}}});
 return captured;
}
beforeAll(async()=>{
 process.env.NODE_ENV='test';process.env.JWT_SECRET=secret;process.env.JWT_ISS='cronus.api';process.env.JWT_AUD='cronus.app';
 h=await createIsolatedMongoHarness(m);
 P=requireCore('./src/models/Part');M=requireCore('./src/models/Manufacturer');W=requireCore('./src/models/WorkOrder');
 requireCore('./src/models/Supplier');mut=requireCore('./src/services/workOrderCosts/mutate');
 await Promise.all([P.init(),M.init()]);
 routers=Object.fromEntries(['part','manufacturer','workOrder','dashboard'].map(n=>[`./src/routers/${n}Router`,requireCore(`./src/routers/${n}Router`)]));
 auth=requireCore('./src/middleware/authMiddleware');app=registeredApplication();
});
beforeEach(()=>{jest.spyOn(console,'log').mockImplementation(()=>{});});
afterEach(async()=>{if(h)await Promise.all([P.deleteMany({}),M.deleteMany({}),W.deleteMany({})]);jest.restoreAllMocks();});
afterAll(async()=>{if(h)await h.stop();});
test('CONTROL: configured and alternate Mongo targets fail closed',async()=>{
 await expect(m.connect(process.env.MONGO_URI)).rejects.toThrow('not issued');
 await expect(m.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued');
});

const snapshot = async (Model, value) => JSON.stringify(await Model.collection.findOne({ _id: new m.Types.ObjectId(value) }));
const archive = (kind, d, role='admin') => send('patch', `/${kind}/${d.id}/archive`, {}, role);
for (const kind of ['parts', 'manufacturers']) {
 const required = kind === 'parts' ? 'description' : 'name';
 for (const role of ['technician', 'admin']) {
  for (const key of ['deletedAt', 'deletedBy', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', '_id', '__v', 'facilityId', 'tenantId', 'referenceReservation', 'referenceReceipt', 'referenceFence', 'referenceReceipts', 'referenceRecoveryHistory']) {
   test(`${kind} ${role}: create and update reject protected ${key} without writes`, async () => {
    const payload = { [key]: key.endsWith('At') ? old : spoof };
    await send('post', `/${kind}`, { ...body(kind), ...payload }, role).expect(400);
    expect(await model(kind).countDocuments()).toBe(0);
    const d = await seed(kind), before = await snapshot(model(kind), d.id);
    await send('put', `/${kind}/${d.id}`, { ...payload, [required]: 'Must not persist' }, role).expect(400);
    expect(await snapshot(model(kind), d.id)).toBe(before);
   });
  }
  test(`${kind} ${role}: active business updates and server audit remain valid`, async () => {
   const r = await send('post', `/${kind}`, body(kind), role).expect(201);
   const d = r.body[kind === 'parts' ? 'part' : 'manufacturer'];
   expect(d.createdBy).toBe(actor); expect(d.updatedBy).toBe(actor);
   expect(d.deletedAt).toBeNull(); expect(d.deletedBy).toBeNull();
   expect(d.createdAt).toBeTruthy(); expect(d.updatedAt).toBeTruthy();
   const fields = kind === 'parts'
    ? { partNumber:'Changed', description:'Changed', price:19, quantityOnHand:7, location:'Shelf', compatibleAssets:[spoof], supplierId:spoof }
    : { name:'Changed', contactName:'Synthetic Contact', email:'contact@example.invalid', phone:'555', address:'Shelf', website:'https://example.invalid' };
   await send('put', `/${kind}/${d._id}`, fields, role).expect(200);
   const changed = await model(kind).findById(d._id).lean();
   expect(JSON.parse(JSON.stringify(changed))).toMatchObject(fields);
   expect(String(changed.createdBy)).toBe(actor); expect(String(changed.updatedBy)).toBe(actor);
   expect(changed.createdAt.toISOString()).toBe(d.createdAt);
  });
  test(`${kind} ${role}: archived ordinary edits and unarchive fail without writes`, async () => {
   const d=await seed(kind); await archive(kind,d).expect(200);
   const before=await snapshot(model(kind),d.id);
   await send('put',`/${kind}/${d.id}`,{[required]:'Changed'},role).expect(409);
   await send('put',`/${kind}/${d.id}`,{status:'Active'},role).expect(409);
   await send('put',`/${kind}/${d.id}`,{deletedAt:null,deletedBy:null,status:'Active'},role).expect(400);
   expect(await snapshot(model(kind),d.id)).toBe(before);
  });
 }
 for (const payload of [{$set:{deletedAt:null}}, {$unset:{deletedAt:1}}, [{$set:{status:'Active'}}], [], {'deletedAt.x':null}, {status:{$ne:'Active'}}]) {
  test(`${kind}: operators, pipelines and dotted updates rejected: ${JSON.stringify(payload)}`,async()=>{
   const d=await seed(kind), before=await snapshot(model(kind),d.id);
   await send('put',`/${kind}/${d.id}`,payload).expect(400);
   await send('post',`/${kind}`,payload).expect(400);
   expect(await snapshot(model(kind),d.id)).toBe(before);expect(await model(kind).countDocuments()).toBe(1);
  });
 }
 test(`${kind}: archive admin-only and idempotent including provenance/timestamps`,async()=>{
  const d=await seed(kind);
  for(const role of ['technician','customer','viewer','tech','unknown'])await archive(kind,d,role).expect(403);
  await request(app).patch(`/${kind}/${d.id}/archive`).send({}).expect(401);
  const r=await archive(kind,d).expect(200);
  expect(r.body.archived.deletedBy).toBe(actor); expect(r.body.archived.updatedBy).toBe(actor);
  const before=await snapshot(model(kind),d.id);
  const other={Authorization:`Bearer ${jwt.sign({sub:spoof,role:'admin'},secret,{issuer:'cronus.api',audience:'cronus.app'})}`};
  await request(app).patch(`/${kind}/${d.id}/archive`).set(other).send({}).expect(200);
  expect(await snapshot(model(kind),d.id)).toBe(before);
 });
 test(`${kind}: non-admin create/update gates and anonymous reads preserved`,async()=>{
  const d=await seed(kind), before=await snapshot(model(kind),d.id);
  for(const role of ['customer','viewer','tech','unknown']){
   await send('post',`/${kind}`,body(kind,'new'),role).expect(403);
   await send('put',`/${kind}/${d.id}`,{[required]:'Changed'},role).expect(403);
  }
  await request(app).get(`/${kind}`).expect(401);
  expect(await snapshot(model(kind),d.id)).toBe(before);
 });
 test(`${kind}: shared active list needs no facility and excludes archives but not status labels`,async()=>{
  const d=await seed(kind), archived=await model(kind).create(body(kind,'archived'));
  await archive(kind,archived).expect(200);
  const statuses=kind==='parts'?['Inactive','Pending','Retired','Active']:['Inactive','Active'];
  for(const status of statuses){
   await send('put',`/${kind}/${d.id}`,{status}).expect(200);
   for(const role of ['admin','technician','customer']){
    const r=await request(app).get(`/${kind}`).set(headers(role,false)).set('x-facility-id',spoof).expect(200);
    expect(r.body.map(x=>x._id)).toEqual([d.id]);expect(r.body[0].deletedAt).toBeNull();
   }
  }
 });
 test(`${kind}: missing legacy deletedAt is unarchived`,async()=>{
  const d=await seed(kind);await model(kind).collection.updateOne({_id:d._id},{$unset:{deletedAt:1}});
  const r=await send('get',`/${kind}`).expect(200);expect(r.body.map(x=>x._id)).toContain(d.id);
  await send('put',`/${kind}/${d.id}`,{[required]:'Changed'}).expect(200);
  await archive(kind,d).expect(200);
  await send('put',`/${kind}/${d.id}`,{[required]:'Changed again'}).expect(409);
 });
 test(`${kind}: allowed-field validators reject invalid status and required-field null`,async()=>{
  for(const payload of [{status:'INVALID'},{[required]:null}]){
   await send('post',`/${kind}`,{...body(kind),...payload}).expect(400);
   expect(await model(kind).countDocuments()).toBe(0);
  }
  const d=await seed(kind), before=await snapshot(model(kind),d.id);
  for(const payload of [{status:'INVALID'},{[required]:null}])await send('put',`/${kind}/${d.id}`,payload).expect(400);
  expect(await snapshot(model(kind),d.id)).toBe(before);
 });
 test(`${kind}: invalid and missing IDs fail safely`,async()=>{
  await send('put',`/${kind}/bad-id`,{[required]:'Changed'}).expect(400);
  await send('put',`/${kind}/${spoof}`,{[required]:'Changed'}).expect(404);
  await send('patch',`/${kind}/bad-id/archive`,{},'admin').expect(400);
  await send('patch',`/${kind}/${spoof}/archive`,{},'admin').expect(404);
 });
 test(`${kind}: archive between read and write prevents ordinary mutation`,async()=>{
  const d=await seed(kind), Model=model(kind), real=Model.findOneAndUpdate.bind(Model);
  jest.spyOn(Model,'findOneAndUpdate').mockImplementationOnce(async (...args)=>{
   await Model.updateOne({_id:d._id},{$set:{deletedAt:new Date(old),deletedBy:spoof}});
   return real(...args);
  });
  await send('put',`/${kind}/${d.id}`,{[required]:'Must not persist'}).expect(409);
  const after=await Model.findById(d.id);
  expect(after[required]).toBe(d[required]);expect(after.deletedAt.toISOString()).toBe(old);
 });
}
test('Part numeric and reference casting validation applies to updates',async()=>{
 const d=await seed('parts'),before=await snapshot(P,d.id);
 for(const payload of [{price:'bad'},{quantityOnHand:null},{supplierId:'bad'},{compatibleAssets:['bad']}]){
  await send('put',`/parts/${d.id}`,payload).expect(400);expect(await snapshot(P,d.id)).toBe(before);
 }
});
test('Part picker preserves compatibleAssets filtering while removing archived rows',async()=>{
 const a=await P.create({...body('parts','a'),compatibleAssets:[spoof]}),b=await P.create({...body('parts','b'),compatibleAssets:[spoof]});
 await P.create(body('parts','unrelated'));await archive('parts',b).expect(200);
 const r=await request(app).get('/parts').query({assetId:spoof}).set(headers()).expect(200);
 expect(r.body.map(x=>x._id)).toEqual([a.id]);
});
test('Part create and reference changes reject archived Manufacturer; unchanged historical link is valid',async()=>{
 const d=await seed('manufacturers');
 const existing=await P.create({...body('parts'),manufacturerId:d._id});
 const unrelated=await P.create(body('parts','unrelated'));
 await archive('manufacturers',d).expect(200);
 const before=await snapshot(P,unrelated.id);
 await send('post','/parts',{...body('parts','new'),manufacturerId:d.id}).expect(409);
 await send('put',`/parts/${unrelated.id}`,{manufacturerId:d.id}).expect(409);
 expect(await snapshot(P,unrelated.id)).toBe(before);expect(await P.countDocuments()).toBe(2);
 await send('put',`/parts/${existing.id}`,{manufacturerId:d.id,description:'Historical edit'}).expect(200);
 expect((await P.findById(existing.id).populate('manufacturerId')).manufacturerId.name).toBe(d.name);
 await send('put',`/parts/${existing.id}`,{manufacturerId:null}).expect(200);
});
test('Manufacturer status label alone does not prevent new references',async()=>{
 const d=await M.create({...body('manufacturers'),status:'Inactive'});
 const r=await send('post','/parts',{...body('parts'),manufacturerId:d.id}).expect(201);
 expect(r.body.part.manufacturerId).toBe(d.id);
 const p=await P.create(body('parts','second'));
 await send('put',`/parts/${p.id}`,{manufacturerId:d.id}).expect(200);
});
test('New Manufacturer references must exist and have valid IDs',async()=>{
 for(const [manufacturerId,status] of [[spoof,404],['invalid',400],[{$ne:null},400]]){
  await send('post','/parts',{...body('parts'),manufacturerId}).expect(status);
 }
 expect(await P.countDocuments()).toBe(0);
});
test('New workorder references exclude archived Parts; history and pricing snapshots survive',async()=>{
 const manufacturer=await seed('manufacturers');
 const p=await P.create({...body('parts'),manufacturerId:manufacturer._id,status:'Retired'});
 const w=await mut.createNative({facilityId:facility,assetId:new m.Types.ObjectId(),description:'Synthetic',createdBy:actor});
 await send('post',`/workorders/${w.id}/parts`,{partId:p.id,quantity:2}).expect(201);
 const before=await W.findById(w.id).lean();expect(before.partsUsed[0].unitCost).toBe(12);expect(before.partsUsed[0].extendedCost).toBe(24);
 await archive('manufacturers',manufacturer).expect(200);await archive('parts',p).expect(200);
 const raw=await snapshot(W,w.id);
 await send('post',`/workorders/${w.id}/parts`,{partId:p.id,quantity:1}).expect(404);
 expect(await snapshot(W,w.id)).toBe(raw);
 const historical=await send('get',`/workorders/${w.id}/parts`).expect(200);
 expect(historical.body[0].partId._id).toBe(p.id);expect(historical.body[0].partId.manufacturerId._id).toBe(manufacturer.id);
 const usage=before.partsUsed[0];
 await send('put',`/workorders/${w.id}/part-usages/${usage._id}`,{note:'Historical note'}).expect(200);
 const after=await W.findById(w.id).lean();expect(after.partsUsed[0].pricing).toEqual(usage.pricing);expect(after.partsUsed[0].unitCost).toBe(12);expect(after.partsUsed[0].extendedCost).toBe(24);
});
test('Dashboard low-stock count includes shared unarchived status labels only',async()=>{
 await P.create({...body('parts','retired'),status:'Retired'});
 const p=await P.create(body('parts','archived'));await archive('parts',p).expect(200);
 const r=await send('get','/dashboard').expect(200);expect(r.body.partsSummary.lowStock).toBe(1);
});


test('CONCURRENCY: stale historical Manufacturer reference cannot undo a concurrent unlink', async () => {
 const manufacturer=await seed('manufacturers');
 const p=await P.create({...body('parts'),manufacturerId:manufacturer._id});
 await archive('manufacturers',manufacturer).expect(200);
 const lifecycle=requireCore('./src/services/referenceLifecycle'),active=lifecycle.activeRecord;let cleared=false;
 jest.spyOn(lifecycle,'activeRecord').mockImplementation(async (...args)=>{
  const previous=await active(...args);
  if(args[0]===P && !cleared){cleared=true;await send('put',`/parts/${p.id}`,{manufacturerId:null}).expect(200);}
  return previous;
 });
 await send('put',`/parts/${p.id}`,{manufacturerId:manufacturer.id,description:'Unrelated edit'}).expect(200);
 const after=await P.findById(p.id);expect(after.manufacturerId).toBeNull();expect(after.description).toBe('Unrelated edit');
});
