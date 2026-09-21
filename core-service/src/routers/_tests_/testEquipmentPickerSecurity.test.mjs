import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

// Permanent accepted-policy regression: mounted routes and fail-closed synthetic DB.
// Assignment is a fixture condition, never presumed to grant Facility authority.
const requireCore=createRequire(new URL('../../../package.json',import.meta.url));
const mongoose=requireCore('mongoose');
const secret='synthetic-s2-picker-only-signing-key';
const oid=()=>new mongoose.Types.ObjectId();
const ids=rows=>rows.map(x=>String(x._id)).sort();
const callerNames=['techA','techB','admin','customer','viewer','legacy','missing','unknown','anonymous','invalid','expired'];
let harness,app,Asset,Template,User,Facility,WorkOrder,a,b,actors,assets,template,wo;
jest.setTimeout(120000);
function headers(name='techA',selected='A',override={}){
  if(name==='anonymous')return {};
  if(name==='invalid')return {Authorization:'Bearer synthetic-invalid'};
  const actor=actors[name==='expired'?'techA':name];
  const claims={sub:String(actor.id),...(actor.role?{role:actor.role}:{}),facilityId:String(actor.home),facilities:actor.facilities.map(String),...override};
  const h={Authorization:`Bearer ${jwt.sign(claims,secret,{issuer:'cronus.api',audience:'cronus.app',expiresIn:name==='expired'?-60:'10m'})}`};
  if(selected!==null)h['x-facility-id']=selected==='A'?String(a):selected==='B'?String(b):selected;
  return h;
}
const picker=(name='techA',selected='A',query={},override={})=>request(app).get('/assets/test-equipment').set(headers(name,selected,override)).query(query);
function registeredApplication(){
  const captured=express();captured.listen=()=>{};
  const real={
    './src/routers/assetsRouter':requireCore('./src/routers/assetsRouter.js'),
    './src/routers/workOrderRouter':requireCore('./src/routers/workOrderRouter.js'),
  };
  const fakeRequire=name=>{
    if(real[name])return real[name];
    if(name==='./src/middleware/authMiddleware')return requireCore('./src/middleware/authMiddleware.js');
    if(name==='express')return Object.assign(()=>captured,express);
    if(name==='path')return path;
    if(name==='process')return {title:'synthetic'};
    if(name==='dotenv')return {config(){}};
    if(name==='debug')return ()=>()=>{};
    if(name.includes('/routers/')){const r=express.Router();r.interactionJsonErrorHandler=r.supplierJsonErrorHandler=r.vendorJsonErrorHandler=r.contactJsonErrorHandler=r.followUpJsonErrorHandler=(_q,_s,next)=>next();return r;}
    if(name==='./src/middleware/forwardContractHeaders')return {attachContractClient:(_q,_s,next)=>next()};
    if(name.includes('/models/'))return {};
    if(name==='./src/config/db')return ()=>{};
    if(name==='./src/cronJobs/index')return {};
    if(['cors','morgan'].includes(name))return ()=>((_q,_s,next)=>next());
    if(name==='express-ejs-layouts')return (_q,_s,next)=>next();
    throw new Error('Unexpected startup dependency '+name);
  };
  vm.runInNewContext(readFileSync(new URL('../../../app.js',import.meta.url),'utf8'),{require:fakeRequire,__dirname:'/synthetic-no-public-files',process:{env:{}},console:{log(){}}});
  return captured;
}
beforeAll(async()=>{
  process.env.JWT_SECRET=secret;process.env.JWT_ISS='cronus.api';process.env.JWT_AUD='cronus.app';
  harness=await createIsolatedMongoHarness(mongoose);
  Asset=requireCore('./src/models/Asset.js');Template=requireCore('./src/models/EquipmentTemplate.js');
  User=requireCore('./src/models/User.js');Facility=requireCore('./src/models/Facility.js');WorkOrder=requireCore('./src/models/WorkOrder.js');
  const axios=requireCore('axios');axios.defaults.adapter=async()=>{throw new Error('External HTTP prohibited');};
  app=registeredApplication();
});
beforeEach(async()=>{
  for(const method of ['log','warn','error'])jest.spyOn(console,method).mockImplementation(()=>{});
  a=oid();b=oid();
  await Facility.collection.insertMany([{_id:a,name:'Synthetic Facility A',organizationId:oid()},{_id:b,name:'Synthetic Facility B',organizationId:oid()}]);
  actors={};assets={};
  for(const [name,role] of [['techA','technician'],['techB','technician'],['admin','admin'],['customer','customer'],['viewer','viewer'],['legacy','tech'],['missing',null],['unknown','synthetic-unknown']]){
    actors[name]={id:oid(),role,home:name==='techB'?b:a,facilities:name==='techB'?[b]:name==='admin'?[a,b]:[a]};
    const u=actors[name];await User.collection.insertOne({_id:u.id,name:'Synthetic '+name,username:'synthetic-'+name,email:name+'@example.invalid',...(role?{role}:{}),facilityId:u.home,facilities:u.facilities});
  }
  template=await Template.create({manufacturer:'Synthetic catalog maker',model:'Synthetic calibration model',isTestEquipment:true,description:'Synthetic catalog detail',benchmark:{notes:'Synthetic catalog benchmark'}});
  for(const name of Object.keys(actors))for(const [label,facilityId] of [['A',a],['B',b]]){
    assets[`${name}-${label}`]=await Asset.create({ctrlNumber:`SYN-${name}-${label}`,manufacturer:'Synthetic '+label+' maker',model:'Synthetic '+label+' model',serialNumber:'SERIAL-'+name+'-'+label,description:'Synthetic '+label+' operational description',notes:'Synthetic '+label+' internal notes',locationNote:'Synthetic '+label+' room',facilityId,assignedTo:actors[name].id,templateId:template._id,purchaseCost:1234,attributes:{syntheticMarker:label},createdBy:actors.admin.id});
  }
  for(const [label,facilityId] of [['A',a],['B',b]])assets['unassigned-'+label]=await Asset.create({ctrlNumber:'SYN-unassigned-'+label,manufacturer:'Synthetic maker',model:'Synthetic model',facilityId,templateId:template._id});
  wo=await WorkOrder.create({facilityId:a,assetId:assets['techA-A']._id,description:'Synthetic A work order'});
});
afterEach(async()=>{for(const m of Object.values(mongoose.models))await m.deleteMany({});jest.restoreAllMocks();});
afterAll(async()=>{if(harness)await harness.stop();});

test('configured and alternate persistence targets fail closed',async()=>{
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued');
});
for(const name of ['techA','techB','admin'])for(const selected of ['A','B'])test(`${name} selected ${selected} requires authority and personal assignment`,async()=>{
  const allowed=name==='admin'||name==='techA'&&selected==='A'||name==='techB'&&selected==='B';
  const r=await picker(name,selected);expect(r.status).toBe(allowed?200:403);
  if(allowed)expect(ids(r.body)).toEqual([String(assets[name+'-'+selected]._id)]);
  else expect(r.body).toEqual({error:'Forbidden'});
});
for(const name of ['techA','admin'])for(const context of [null,'bad-id','000000000000000000000099'])test(`${name} rejects missing/malformed/nonexistent selection ${context}`,async()=>{
  const allowedMissing='000000000000000000000099';
  const override=context===allowedMissing?{facilities:[String(a),allowedMissing]}:{};
  const find=jest.spyOn(Asset,'find');
  const r=await picker(name,context,{},override);
  expect(r.status).toBe(context===allowedMissing?404:400);expect(find).not.toHaveBeenCalled();
  expect(r.body).toEqual({error:context===allowedMissing?'Facility not found':context===null?'x-facility-id header is required':'Invalid reference'});
});
test('ungranted nonexistent context is denied without disclosing existence',async()=>{
  const find=jest.spyOn(Facility,'findById');
  await picker('techA','000000000000000000000099').expect(403,{error:'Forbidden'});expect(find).not.toHaveBeenCalled();
});
for(const name of ['customer','viewer','legacy','missing','unknown','anonymous','invalid','expired'])test(`${name} cannot query picker records`,async()=>{
  const find=jest.spyOn(Asset,'find'),facilities=jest.spyOn(Facility,'findById');
  const r=await picker(name);expect(r.status).toBe(name==='anonymous'?401:403);
  expect(find).not.toHaveBeenCalled();expect(facilities).not.toHaveBeenCalled();
  expect(r.body).toEqual({error:expect.any(String)});expect(JSON.stringify(r.body)).not.toContain('SYN-');
});
test('empty authority does not fall back to assignment',async()=>{
  await picker('techA','A',{}, {facilities:[],facilityId:null}).expect(403);
});
test('multiple authorized Facilities still use selected Facility only',async()=>{
  const r=await picker('techA','B',{}, {facilities:[String(a),String(b)]}).expect(200);
  expect(ids(r.body)).toEqual([String(assets['techA-B']._id)]);
});
test('unassigned or assigned to another user is excluded even in selected Facility',async()=>{
  const r=await picker().expect(200);expect(ids(r.body)).toEqual([String(assets['techA-A']._id)]);
  for(const key of ['techA-B','techB-B','techB-A','unassigned-A','unassigned-B'])expect(ids(r.body)).not.toContain(String(assets[key]._id));
});
test('admin without personal assignments does not receive a Facility browser',async()=>{
  await Asset.updateMany({assignedTo:actors.admin.id},{$unset:{assignedTo:1}});
  await picker('admin','A').expect(200,[]);
});
for(const kind of ['non-test','missing','null'])test(`Template eligibility excludes ${kind}`,async()=>{
  const id=kind==='null'?null:kind==='missing'?oid():(await Template.create({manufacturer:'Synthetic other',model:'Synthetic other',isTestEquipment:false}))._id;
  await Asset.updateOne({_id:assets['techA-A']._id},{$set:{templateId:id}});
  await picker().expect(200,[]);
});
for(const status of ['Inactive','Pending','Retired','Archived'])test(`${status} is not active picker equipment`,async()=>{
  await Asset.updateOne({_id:assets['techA-A']._id},{$set:{status}});
  await picker().expect(200,[]);
});
for(const patch of [{deletedAt:new Date('2001-01-01')},{isArchived:true}])test(`active status cannot override archive metadata ${JSON.stringify(patch)}`,async()=>{
  await Asset.updateOne({_id:assets['techA-A']._id},{$set:patch});
  await picker().expect(200,[]);
});
test('actual admin archive removes Asset from picker without deleting history',async()=>{
  await request(app).patch(`/assets/${assets['techA-A']._id}/archive`).set(headers('admin')).send({}).expect(200);
  await picker().expect(200,[]);expect(await Asset.exists({_id:assets['techA-A']._id})).not.toBeNull();
});
test('legacy absent deletion metadata is eligible only with explicit Active status',async()=>{
  await Asset.collection.updateOne({_id:assets['techA-A']._id},{$unset:{deletedAt:1,isArchived:1}});
  expect(ids((await picker().expect(200)).body)).toEqual([String(assets['techA-A']._id)]);
  await Asset.collection.updateOne({_id:assets['techA-A']._id},{$unset:{status:1}});
  await picker().expect(200,[]);
});
test('response contains exactly the four consumer fields, excluding all stored extras and Template',async()=>{
  await Asset.collection.updateOne({_id:assets['techA-A']._id},{$set:{legacySensitive:'Synthetic stored extra'}});
  const r=await picker().expect(200);
  expect(r.body).toEqual([{_id:String(assets['techA-A']._id),ctrlNumber:'SYN-techA-A',manufacturer:'Synthetic A maker',model:'Synthetic A model'}]);
  expect(Object.keys(r.body[0]).sort()).toEqual(['_id','ctrlNumber','manufacturer','model']);
});
for(const query of [{facilityId:'B'},{assignedTo:'B'},{search:'no-match'},{status:'Archived'},{'$or[0][facilityId]':'B'},{'facilityId[$ne]':'A'}])test(`query parameters cannot replace scope/eligibility ${JSON.stringify(query)}`,async()=>{
  const q=Object.fromEntries(Object.entries(query).map(([k,v])=>[k,v==='A'?String(a):v==='B'?String(b):v]));
  expect(ids((await picker('techA','A',q).expect(200)).body)).toEqual([String(assets['techA-A']._id)]);
});
for(const name of ['techA','admin'])test(`#5 ${name} local attachment succeeds and foreign attachment remains denied`,async()=>{
  const before=JSON.stringify(await WorkOrder.findById(wo._id).lean());
  await request(app).post(`/workorders/${wo._id}/test-equipment`).set(headers(name)).send({equipmentId:String(assets['techA-B']._id)}).expect(404,{error:'Equipment not found'});
  expect(JSON.stringify(await WorkOrder.findById(wo._id).lean())).toBe(before);
  await request(app).post(`/workorders/${wo._id}/test-equipment`).set(headers(name)).send({equipmentId:String(assets['techA-A']._id)}).expect(200);
  expect((await WorkOrder.findById(wo._id)).testEquipmentUsed).toHaveLength(1);
});
for(const target of ['asset','facility'])test(`unexpected ${target} lookup error is generic and safe`,async()=>{
  jest.spyOn(target==='asset'?Asset:Facility,target==='asset'?'find':'findById').mockImplementation(()=>{throw new Error('Synthetic protected internal details');});
  await picker().expect(500,{error:'Internal Server Error'});
});
test('malformed authenticated identity fails safely rather than querying assignment',async()=>{
  const find=jest.spyOn(Asset,'find');await picker('techA','A',{}, {sub:'malformed'}).expect(400,{error:'Invalid reference'});
  expect(find).not.toHaveBeenCalled();
});
