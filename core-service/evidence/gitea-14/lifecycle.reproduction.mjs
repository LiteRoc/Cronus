import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../src/test/mongoMemoryHarness.mjs';
const requireCore = createRequire(new URL('../../package.json', import.meta.url));
const m = requireCore('mongoose');
const actor='000000000000000000000001', spoof='000000000000000000000002', facility='000000000000000000000003';
const old='2001-02-03T04:05:06.000Z', secret='synthetic-gitea14-only';
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
 vm.runInNewContext(readFileSync(new URL('../../app.js',import.meta.url),'utf8'),{require:fakeRequire,__dirname:'/synthetic-no-public-files',process:{env:{}},console:{log(){}}});
 return captured;
}
beforeAll(async()=>{
 process.env.NODE_ENV='test';process.env.JWT_SECRET=secret;process.env.JWT_ISS='cronus.api';process.env.JWT_AUD='cronus.app';
 h=await createIsolatedMongoHarness(m);
 P=requireCore('./src/models/Part');M=requireCore('./src/models/Manufacturer');W=requireCore('./src/models/WorkOrder');
 requireCore('./src/models/Supplier');mut=requireCore('./src/services/workOrderCosts/mutate');
 await Promise.all([P.init(),M.init()]);
 routers=Object.fromEntries(['part','manufacturer','workOrder'].map(n=>[`./src/routers/${n}Router`,requireCore(`./src/routers/${n}Router`)]));
 auth=requireCore('./src/middleware/authMiddleware');app=registeredApplication();
});
beforeEach(()=>{jest.spyOn(console,'log').mockImplementation(()=>{});});
afterEach(async()=>{if(h)await Promise.all([P.deleteMany({}),M.deleteMany({}),W.deleteMany({})]);jest.restoreAllMocks();});
afterAll(async()=>{if(h)await h.stop();});
test('CONTROL: configured and alternate Mongo targets fail closed',async()=>{
 await expect(m.connect(process.env.MONGO_URI)).rejects.toThrow('not issued');
 await expect(m.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued');
});
for(const kind of ['parts','manufacturers']){
 test(`${kind} CONTROL: authentication and mutation role gates`,async()=>{
  const d=await seed(kind);
  await request(app).get(`/${kind}`).expect(401);
  for(const role of ['customer','viewer','tech','unknown']){
   await send('post',`/${kind}`,body(kind,'new'),role).expect(403);
   await send('put',`/${kind}/${d.id}`,{status:'Active'},role).expect(403);
  }
  await send('patch',`/${kind}/${d.id}/archive`,{},'technician').expect(403);
  expect((await model(kind).findById(d.id)).deletedAt).toBeNull();
 });
 test(`${kind} OBSERVATION: technician forges archive metadata and creator through ordinary PUT`,async()=>{
  const d=await seed(kind);
  await send('put',`/${kind}/${d.id}`,{deletedAt:old,deletedBy:spoof,createdBy:spoof,updatedBy:spoof,status:kind==='parts'?'Retired':'Inactive'}).expect(200);
  const s=await model(kind).findById(d.id);
  expect(s.deletedAt.toISOString()).toBe(old);expect(String(s.deletedBy)).toBe(spoof);expect(String(s.createdBy)).toBe(spoof);expect(String(s.updatedBy)).toBe(actor);
 });
 test(`${kind} OBSERVATION: technician reverses real admin archive via ordinary PUT`,async()=>{
  const d=await seed(kind);
  await send('patch',`/${kind}/${d.id}/archive`,{},'admin').expect(200);
  expect((await model(kind).findById(d.id)).deletedAt).not.toBeNull();
  await send('put',`/${kind}/${d.id}`,{deletedAt:null,deletedBy:null,status:'Active'}).expect(200);
  const s=await model(kind).findById(d.id);expect(s.deletedAt).toBeNull();expect(s.deletedBy).toBeNull();expect(s.status).toBe('Active');
 });
 test(`${kind} OBSERVATION: update operators remove archive metadata and creator`,async()=>{
  const d=await seed(kind);await send('patch',`/${kind}/${d.id}/archive`,{},'admin').expect(200);
  await send('put',`/${kind}/${d.id}`,{$unset:{deletedAt:1,deletedBy:1,createdBy:1},$set:{status:'Active'}}).expect(200);
  const s=await model(kind).collection.findOne({_id:d._id});
  for(const k of ['deletedAt','deletedBy','createdBy'])expect(s).not.toHaveProperty(k);
  expect(s.status).toBe('Active');
 });
 test(`${kind} OBSERVATION: create accepts archive metadata, spoofed updater, identity and timestamps`,async()=>{
  const id=new m.Types.ObjectId();
  await send('post',`/${kind}`,{...body(kind),_id:String(id),createdBy:spoof,updatedBy:spoof,deletedAt:old,deletedBy:spoof,createdAt:old,updatedAt:old}).expect(201);
  const s=await model(kind).findById(id);expect(String(s.createdBy)).toBe(actor);expect(String(s.updatedBy)).toBe(spoof);expect(String(s.deletedBy)).toBe(spoof);expect(s.deletedAt.toISOString()).toBe(old);expect(s.createdAt.toISOString()).toBe(old);expect(s.updatedAt.toISOString()).toBe(old);
 });
 test(`${kind} OBSERVATION: archived records remain in admin and technician lists`,async()=>{
  const d=await seed(kind);await send('patch',`/${kind}/${d.id}/archive`,{},'admin').expect(200);
  for(const role of ['admin','technician','customer']){const r=await send('get',`/${kind}`,undefined,role).expect(200);expect(r.body.map(x=>x._id)).toContain(d.id);}
 });
 test(`${kind} OBSERVATION: business edits on archived rows and invalid status persist`,async()=>{
  const d=await seed(kind);await send('patch',`/${kind}/${d.id}/archive`,{},'admin').expect(200);
  await send('put',`/${kind}/${d.id}`,{...body(kind,'edited'),status:'UNDECLARED'}).expect(200);
  expect((await model(kind).findById(d.id)).status).toBe('UNDECLARED');
 });
 test(`${kind} OBSERVATION: shared list depends on facility context`,async()=>{
  await seed(kind);await request(app).get(`/${kind}`).set(headers('technician',false)).expect(500);
 });
 test(`${kind} SECURITY: ordinary update must preserve archive metadata`,async()=>{
  const d=await seed(kind);await send('patch',`/${kind}/${d.id}/archive`,{},'admin').expect(200);
  await send('put',`/${kind}/${d.id}`,{deletedAt:null,deletedBy:null,status:'Active'});
  expect((await model(kind).findById(d.id)).deletedAt).not.toBeNull();
 });
 test(`${kind} SECURITY: normal list must exclude archived rows`,async()=>{
  const d=await seed(kind);await send('patch',`/${kind}/${d.id}/archive`,{},'admin').expect(200);
  const r=await send('get',`/${kind}`).expect(200);expect(r.body.map(x=>x._id)).not.toContain(d.id);
 });
}
test('OBSERVATION: Part create and update accept archived Manufacturer; old reference still populates',async()=>{
 const manufacturer=await seed('manufacturers');const existing=await P.create({...body('parts'),manufacturerId:manufacturer._id});
 await send('patch',`/manufacturers/${manufacturer.id}/archive`,{},'admin').expect(200);
 const r=await send('post','/parts',{...body('parts','new'),manufacturerId:manufacturer.id}).expect(201);
 const unrelated=await P.create(body('parts','unrelated'));
 await send('put',`/parts/${unrelated.id}`,{manufacturerId:manufacturer.id}).expect(200);
 expect(String((await P.findById(unrelated.id)).manufacturerId)).toBe(manufacturer.id);
 expect(String((await P.findById(r.body.part._id)).manufacturerId)).toBe(manufacturer.id);
 expect((await P.findById(existing.id).populate('manufacturerId')).manufacturerId.name).toBe(manufacturer.name);
});
test('OBSERVATION: archived Part can be newly attached over mounted workorder endpoint; historical read survives',async()=>{
 const p=await seed('parts');
 const w=await mut.createNative({facilityId:facility,assetId:new m.Types.ObjectId(),description:'Synthetic',createdBy:actor});
 await send('post',`/workorders/${w.id}/parts`,{partId:p.id,quantity:1}).expect(201);
 await send('patch',`/parts/${p.id}/archive`,{},'admin').expect(200);
 const r=await send('get',`/workorders/${w.id}/parts`).expect(200);expect(r.body[0].partId._id).toBe(p.id);
 await send('post',`/workorders/${w.id}/parts`,{partId:p.id,quantity:2}).expect(201);
 expect((await W.findById(w.id)).partsUsed).toHaveLength(2);
});
test('SECURITY: archived Manufacturer must not gain new Part references',async()=>{
 const d=await seed('manufacturers');await send('patch',`/manufacturers/${d.id}/archive`,{},'admin').expect(200);
 await send('post','/parts',{...body('parts'),manufacturerId:d.id});expect(await P.countDocuments()).toBe(0);
});
test('SECURITY: archived Part must not gain new workorder usages',async()=>{
 const p=await seed('parts');await send('patch',`/parts/${p.id}/archive`,{},'admin').expect(200);
 const w=await mut.createNative({facilityId:facility,assetId:new m.Types.ObjectId(),description:'Synthetic',createdBy:actor});
 await send('post',`/workorders/${w.id}/parts`,{partId:p.id,quantity:1});expect((await W.findById(w.id)).partsUsed).toHaveLength(0);
});
