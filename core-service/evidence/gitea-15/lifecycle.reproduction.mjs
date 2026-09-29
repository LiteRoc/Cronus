import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../src/test/mongoMemoryHarness.mjs';
const requireCore=createRequire(new URL('../../package.json',import.meta.url));
const m=requireCore('mongoose'), axios=requireCore('axios');
const actor='000000000000000000000001', spoof='000000000000000000000002', facility='000000000000000000000003';
const old='2001-02-03T04:05:06.000Z', secret='synthetic-gitea15-only';
let h,app,T,A,F,routers,auth,adapter,providerCalls;
const oid=()=>new m.Types.ObjectId();
const payload=(extra={})=>({manufacturer:'Synthetic maker',model:'Synthetic model',description:'Synthetic description',equipmentClass:'Class II',...extra});
const seed=(extra={})=>T.create(payload(extra));
const headers=(role='technician',context=true)=>role==='anonymous'?{}:({Authorization:`Bearer ${jwt.sign({sub:actor,...(role==='missing'?{}:{role}),...(context?{facilityId:facility,facilities:[facility]}:{})},secret,{issuer:'cronus.api',audience:'cronus.app',expiresIn:'10m'})}`,...(context?{'x-facility-id':facility}:{})});
const send=(method,url,data,role='technician',context=true)=>request(app)[method](url).set(headers(role,context)).send(data);
const archive=d=>send('patch',`/templates/${d.id}/achive`,{},'admin').expect(200);
const stored=d=>T.collection.findOne({_id:d._id});
jest.setTimeout(120000);
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
 process.env.NODE_ENV='test';process.env.JWT_SECRET=secret;process.env.JWT_ISS='cronus.api';process.env.JWT_AUD='cronus.app';process.env.FDA_GUDID_BASE='http://synthetic-provider.invalid';
 // Baseline Template partial index uses unsupported $exists:false. Preserve that
 // setup failure separately; lifecycle reproduction does not rebuild indexes.
 m.set('autoIndex',false);
 h=await createIsolatedMongoHarness(m);
 T=requireCore('./src/models/EquipmentTemplate');A=requireCore('./src/models/Asset');F=requireCore('./src/models/Facility');
 await Promise.all([T.init(),A.init()]);
 adapter=axios.defaults.adapter;
 axios.defaults.adapter=async config=>{
  if(config.url!=='http://synthetic-provider.invalid/devices/lookup.json')throw Error('Unexpected external request refused');
  providerCalls++;
  return {data:{device:{di:config.params.di,companyName:'Synthetic provider',versionModelNumber:'Synthetic provider model',deviceDescription:'Synthetic refreshed description'}},status:200,statusText:'OK',headers:{},config};
 };
 routers=Object.fromEntries(['templates','assets','dashboard'].map(n=>[`./src/routers/${n}Router`,requireCore(`./src/routers/${n}Router`)]));
 auth=requireCore('./src/middleware/authMiddleware');app=registeredApplication();
 writeFileSync(new URL('./mounted-template-routes.json',import.meta.url),JSON.stringify(routers['./src/routers/templatesRouter'].stack.filter(l=>l.route).map(l=>({methods:Object.keys(l.route.methods),path:'/templates'+l.route.path})),null,2)+'\n');
});
beforeEach(async()=>{
 for(const method of ['log','warn','error','dir'])jest.spyOn(console,method).mockImplementation(()=>{});
 providerCalls=0;await F.collection.insertOne({_id:new m.Types.ObjectId(facility),name:'Synthetic facility'});
});
afterEach(async()=>{if(h)await Promise.all([T.deleteMany({}),A.deleteMany({}),F.deleteMany({})]);jest.restoreAllMocks();});
afterAll(async()=>{axios.defaults.adapter=adapter;if(h)await h.stop();});
test('CONTROL: configured and alternative Mongo targets fail closed',async()=>{
 await expect(m.connect(process.env.MONGO_URI)).rejects.toThrow('not issued');
 await expect(m.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued');
});
for(const role of ['anonymous','customer','viewer','tech','missing','unknown'])test(`CONTROL: ${role} cannot use role-gated Template routes`,async()=>{
 const d=await seed({di:'00000000000001'}),expected=role==='anonymous'?401:403;
 for(const [method,url,data] of [
 ['get','/templates'],['get',`/templates/${d.id}`],['post','/templates',payload()],
 ['put',`/templates/${d.id}`,{status:'Archived'}],['patch',`/templates/${d.id}/achive`,{}],
 ['patch',`/templates/${d.id}/sync-gudid`,{}],['post','/templates/from-di',{di:d.di}],['post','/templates/from-di-or-udi',{di:d.di}]
 ])await send(method,url,data,role).expect(expected);
 expect(providerCalls).toBe(0);expect((await stored(d)).status).toBe('Active');
});
for(const role of ['admin','technician'])test(`OBSERVATION: ${role} PUT can archive restore set arbitrary status and bypass nested validators`,async()=>{
 const d=await seed();
 if(role==='technician')await send('patch',`/templates/${d.id}/achive`,{},role).expect(403);
 await send('put',`/templates/${d.id}`,{status:'Archived'},role,false).expect(200);expect((await stored(d)).status).toBe('Archived');
 await send('put',`/templates/${d.id}`,{status:'Active'},role).expect(200);expect((await stored(d)).status).toBe('Active');
 await send('put',`/templates/${d.id}`,{status:'UNDECLARED',lifecycleDefaults:{expectedLifeYears:-10},benchmark:{confidence:'UNDECLARED'},verified:true},role).expect(200);
 const s=await stored(d);expect(s.status).toBe('UNDECLARED');expect(s.lifecycleDefaults.expectedLifeYears).toBe(-10);expect(s.benchmark.confidence).toBe('UNDECLARED');expect(s.verified).toBe(true);
});
test('OBSERVATION: admin archive stores status but drops intended audit fields; repeat succeeds',async()=>{
 const d=await seed();await archive(d);await archive(d);const s=await stored(d);
 expect(s.status).toBe('Archived');for(const k of ['deletedAt','deletedBy','updatedBy','createdBy'])expect(s).not.toHaveProperty(k);
});
test('OBSERVATION: technician edits archived row then restores real admin archive',async()=>{
 const d=await seed();await archive(d);
 await send('put',`/templates/${d.id}`,{description:'Edited while archived'}).expect(200);expect((await stored(d)).description).toBe('Edited while archived');
 await send('put',`/templates/${d.id}`,{status:'Active',deletedAt:null,deletedBy:null,updatedBy:spoof}).expect(200);
 expect((await stored(d)).status).toBe('Active');expect((await stored(d))).not.toHaveProperty('updatedBy');
});
test('OBSERVATION: PUT operators remove status and required fields; timestamps stay server-controlled',async()=>{
 const d=await seed();await archive(d);const before=await stored(d);
 await send('put',`/templates/${d.id}`,{$unset:{status:1,manufacturer:1},$set:{createdAt:old,updatedAt:old,deletedAt:old,deletedBy:spoof,createdBy:spoof,updatedBy:spoof}}).expect(200);
 const s=await stored(d);expect(s).not.toHaveProperty('status');expect(s).not.toHaveProperty('manufacturer');expect(s.createdAt).toEqual(before.createdAt);expect(s.updatedAt.toISOString()).not.toBe(old);
 for(const k of ['deletedAt','deletedBy','createdBy','updatedBy'])expect(s).not.toHaveProperty(k);
});
test('OBSERVATION: admin create accepts identity timestamps status verification dangling duplicate reference; drops audit fields',async()=>{
 const id=oid(),duplicate=oid();
 await send('post','/templates',payload({_id:String(id),status:'Archived',verified:true,duplicateOf:String(duplicate),createdAt:old,updatedAt:old,createdBy:spoof,updatedBy:spoof,deletedAt:old,deletedBy:spoof}),'admin').expect(201);
 const s=await T.collection.findOne({_id:id});expect(s.status).toBe('Archived');expect(s.verified).toBe(true);expect(String(s.duplicateOf)).toBe(String(duplicate));expect(s.createdAt.toISOString()).toBe(old);expect(s.updatedAt.toISOString()).toBe(old);
 for(const k of ['createdBy','updatedBy','deletedAt','deletedBy'])expect(s).not.toHaveProperty(k);
});
test('OBSERVATION: array update pipeline persists undeclared audit fields and forges createdAt',async()=>{
 const d=await seed();await archive(d);
 await send('put',`/templates/${d.id}`,[{$set:{status:'Active',createdBy:spoof,updatedBy:spoof,deletedBy:spoof,deletedAt:old,createdAt:old,updatedAt:old}}]).expect(200);
 const s=await stored(d);expect(s.status).toBe('Active');
 for(const k of ['createdBy','updatedBy','deletedBy'])expect(s[k]).toBe(spoof);
 expect(s.deletedAt).toBe(old);expect(s.createdAt).toBe(old);expect(s.updatedAt.toISOString()).not.toBe(old);
});
test('OBSERVATION: synthetic deletedAt-marked Template remains listed and newly referenceable',async()=>{
 const d=await seed();await T.collection.updateOne({_id:d._id},{$set:{deletedAt:new Date(old),deletedBy:new m.Types.ObjectId(spoof)}});
 const r=await send('get','/templates').expect(200);expect(r.body.templates.map(x=>x._id)).toContain(d.id);
 await send('post','/assets',{ctrlNumber:'DELETED-MARKER',templateId:d.id}).expect(201);
});
test('OBSERVATION: duplicateOf can newly reference archived Template via manual create and ordinary update',async()=>{
 const d=await seed({di:'00000000000001'});await archive(d);
 const r=await send('post','/templates',payload({di:'00000000000002',model:'Synthetic distinct',duplicateOf:d.id}),'admin').expect(201);
 expect(r.body.template.duplicateOf).toBe(d.id);
 await send('put',`/templates/${r.body.template._id}`,{duplicateOf:d.id}).expect(200);
 const populated=await T.findById(r.body.template._id).populate('duplicateOf');expect(populated.duplicateOf.id).toBe(d.id);
});
test('OBSERVATION: archived Template remains in list count detail and distinct picker data',async()=>{
 const d=await seed();await archive(d);
 for(const role of ['admin','technician']){
  const r=await send('get','/templates',undefined,role,false).expect(200);expect(r.body.totalCount).toBe(1);expect(r.body.templates[0]._id).toBe(d.id);
  await send('get',`/templates/${d.id}`,undefined,role,false).expect(200);
  const makers=await send('get','/templates/distinct/manufacturers',undefined,role,false).expect(200);expect(makers.body).toContain(d.manufacturer);
  const models=await send('get',`/templates/distinct/models?manufacturer=${encodeURIComponent(d.manufacturer)}`,undefined,role,false).expect(200);expect(models.body).toContain(d.model);
 }
});
for(const role of ['customer','viewer','tech','missing','unknown'])test(`OBSERVATION: ${role} passes authentication-only distinct and lifecycle reads`,async()=>{
 const d=await seed();await archive(d);
 await send('get','/templates/distinct/manufacturers',undefined,role).expect(200);
 const models=await send('get',`/templates/distinct/models?manufacturer=${encodeURIComponent(d.manufacturer)}`,undefined,role).expect(200);expect(models.body).toContain(d.model);
 await send('get',`/templates/${d.id}/lifecycle`,undefined,role).expect(200);
});
test('CONTROL: lifecycle requires authorized selected Facility and all reads require authentication',async()=>{
 const d=await seed();await send('get',`/templates/${d.id}/lifecycle`,undefined,'technician',false).expect(400);
 await request(app).get(`/templates/${d.id}/lifecycle`).set(headers()).set('x-facility-id',String(oid())).expect(403);
 for(const url of ['/templates/distinct/manufacturers','/templates/distinct/models?manufacturer=Synthetic',`/templates/${d.id}/lifecycle`])await send('get',url,undefined,'anonymous').expect(401);
});
test('OBSERVATION: archived Template accepts Asset POST and PUT references; history detail batch lifecycle and test-equipment picker survive',async()=>{
 const d=await seed({lifecycleDefaults:{expectedLifeYears:9},isTestEquipment:true});
 const historical=await A.create({ctrlNumber:'HISTORY',manufacturer:'Synthetic',model:'History',facilityId:facility,templateId:d._id,assignedTo:actor});
 const unrelated=await A.create({ctrlNumber:'UNRELATED',manufacturer:'Synthetic',model:'Unrelated',facilityId:facility});await archive(d);
 const r=await send('post','/assets',{ctrlNumber:'NEW',templateId:d.id}).expect(201);expect(r.body.asset.templateId).toBe(d.id);
 await send('put',`/assets/${unrelated.id}`,{templateId:d.id}).expect(200);expect(String((await A.findById(unrelated.id)).templateId)).toBe(d.id);
 const detail=await send('get',`/assets/${historical.id}`).expect(200);expect(detail.body.templateId._id).toBe(d.id);
 const batch=await send('post','/assets/batch',{assetIds:[historical.id]}).expect(200);expect(batch.body.assets[0].templateId._id).toBe(d.id);
 const life=await send('get',`/assets/${historical.id}/lifecycle`).expect(200);expect(life.body.templateId).toBe(d.id);
 const summary=await send('get',`/templates/${d.id}/lifecycle`).expect(200);expect(summary.body.summary.totalAssets).toBe(3);
 const picker=await send('get','/assets/test-equipment').expect(200);expect(picker.body.map(x=>x._id)).toContain(historical.id);
 await send('put',`/assets/${historical.id}`,{description:'Historical edit',templateId:d.id}).expect(200);
});
test('OBSERVATION: DI upsert resurrects archived Template and optionally creates new Asset reference',async()=>{
 const d=await seed({di:'00000000000001'});
 for(const createAsset of [false,true]){
  await archive(d);const r=await send('post','/templates/from-di-or-udi',{di:d.di,udi:'(01)00000000000001',createAsset,asset:{ctrlNumber:'UDI-NEW'}}).expect(201);
  expect(r.body.template._id).toBe(d.id);expect((await stored(d)).status).toBe('Active');expect((await stored(d)).manufacturer).toBe('Synthetic provider');if(createAsset)expect(r.body.asset.templateId).toBe(d.id);
 }
});
test('OBSERVATION: sync-gudid edits archived Template without restoring status or recording actor',async()=>{
 const d=await seed({di:'00000000000001'});await archive(d);await send('patch',`/templates/${d.id}/sync-gudid`,{}).expect(200);
 const s=await stored(d);expect(s.status).toBe('Archived');expect(s.manufacturer).toBe('Synthetic provider');expect(s).not.toHaveProperty('updatedBy');
});
test('OBSERVATION: from-di returns 500 before provider with undefined createAsset',async()=>{
 const r=await send('post','/templates/from-di',{di:'00000000000001'}).expect(500);expect(r.body.error).toBe('createAsset is not defined');expect(providerCalls).toBe(0);expect(await T.countDocuments()).toBe(0);
});
test('OBSERVATION: frontend DELETE and correctly spelled archive route are unmounted 404',async()=>{
 const d=await seed();await send('delete',`/templates/${d.id}`,{},'admin').expect(404);await send('patch',`/templates/${d.id}/archive`,{},'admin').expect(404);expect((await stored(d)).status).toBe('Active');
});
test('OBSERVATION: absent Template PUT and invalid archive identifier return 500',async()=>{
 await send('put',`/templates/${oid()}`,{description:'Synthetic'}).expect(500);await send('patch','/templates/not-an-id/achive',{},'admin').expect(500);
});
// Desired boundaries deliberately fail on the frozen baseline; policy is still proposed.
test('SECURITY: technician ordinary PUT must not undo admin archive',async()=>{
 const d=await seed();await archive(d);await send('put',`/templates/${d.id}`,{status:'Active'});expect((await stored(d)).status).toBe('Archived');
});
test('SECURITY: normal selection list must exclude archived Templates',async()=>{
 const d=await seed();await archive(d);const r=await send('get','/templates').expect(200);expect(r.body.templates.map(x=>x._id)).not.toContain(d.id);
});
test('SECURITY: archived Template must not acquire new Asset reference',async()=>{
 const d=await seed();await archive(d);await send('post','/assets',{ctrlNumber:'FORBIDDEN',templateId:d.id});expect(await A.countDocuments()).toBe(0);
});
test('SECURITY: archive must persist actor and timestamp',async()=>{
 const d=await seed();await archive(d);const s=await stored(d);expect(String(s.deletedBy)).toBe(actor);expect(s.deletedAt).toBeInstanceOf(Date);
});
