import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

// Main 2f7bea8: actual mounted routes, actual auth and fail-closed synthetic DB.
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

test('CONTROL: harness refuses configured and arbitrary Mongo targets',async()=>{
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued');
});
for(const name of callerNames)for(const selected of ['A','B',null,'not-a-facility','000000000000000000000099']){
  test(`OBSERVATION: ${name} picker selected ${selected??'missing'}`,async()=>{
    const r=await picker(name,selected);
    if(['anonymous','invalid','expired'].includes(name)){
      expect(r.status).toBe(name==='anonymous'?401:403);expect(JSON.stringify(r.body)).not.toContain('SYN-');
    }else{
      expect(r.status).toBe(200);expect(ids(r.body)).toEqual(ids([assets[name+'-A'],assets[name+'-B']]));
      expect(r.body.every(x=>x.assignedTo===String(actors[name].id))).toBe(true);
    }
  });
}
test('CONTROL: selected-A technician normal detail/list do not disclose stale-assigned B',async()=>{
  const detail=await request(app).get('/assets/'+assets['techA-B']._id).set(headers());expect(detail.status).toBe(404);
  const list=await request(app).get('/assets').set(headers()).expect(200);
  expect(list.body.assets.some(x=>x._id===String(assets['techA-A']._id))).toBe(true);
  expect(list.body.assets.some(x=>x.facilityId===String(b)||x._id===String(assets['techA-B']._id))).toBe(false);
});
test('CONTROL: assignment narrows results but is not evaluated against Facility authorization',async()=>{
  const r=await picker().expect(200);expect(ids(r.body)).toEqual(ids([assets['techA-A'],assets['techA-B']]));
  for(const key of ['techB-B','unassigned-A','unassigned-B'])expect(ids(r.body)).not.toContain(String(assets[key]._id));
});
test('OBSERVATION: caller with no Facility claims still receives assigned Assets',async()=>{
  const r=await picker('techA',null,{}, {facilities:[],facilityId:null}).expect(200);
  expect(ids(r.body)).toEqual(ids([assets['techA-A'],assets['techA-B']]));
});
test('OBSERVATION: multi-Facility caller selected B still receives assigned A and B',async()=>{
  const r=await picker('techA','B',{}, {facilities:[String(a),String(b)]}).expect(200);
  expect(ids(r.body)).toEqual(ids([assets['techA-A'],assets['techA-B']]));
});
test('OBSERVATION: admin without assignments gets empty result, not all equipment',async()=>{
  await Asset.updateMany({assignedTo:actors.admin.id},{$unset:{assignedTo:1}});
  await picker('admin',null).expect(200,[]);
});
test('OBSERVATION: full foreign Asset and populated Template fields disclosed',async()=>{
  const r=await picker().expect(200);const row=r.body.find(x=>x._id===String(assets['techA-B']._id));
  expect(row).toMatchObject({ctrlNumber:'SYN-techA-B',manufacturer:'Synthetic B maker',model:'Synthetic B model',serialNumber:'SERIAL-techA-B',description:'Synthetic B operational description',notes:'Synthetic B internal notes',locationNote:'Synthetic B room',facilityId:String(b),assignedTo:String(actors.techA.id),status:'Active',isArchived:false,deletedAt:null,purchaseCost:1234,attributes:{syntheticMarker:'B'},createdBy:String(actors.admin.id)});
  for(const key of ['_id','createdAt','updatedAt','__v','metrics','maintenanceSchedule','documents','images'])expect(row).toHaveProperty(key);
  expect(row.templateId).toMatchObject({_id:String(template._id),isTestEquipment:true,description:'Synthetic catalog detail',benchmark:{notes:'Synthetic catalog benchmark'}});
});
for(const kind of ['non-test template','missing template','null template'])test(`CONTROL: ${kind} is excluded`,async()=>{
  let id=null;if(kind==='non-test template')id=(await Template.create({manufacturer:'Synthetic other',model:'Synthetic other',isTestEquipment:false}))._id;
  if(kind==='missing template')id=oid();
  await Asset.updateOne({_id:assets['techA-A']._id},{$set:{templateId:id}});
  const r=await picker().expect(200);expect(ids(r.body)).toEqual([String(assets['techA-B']._id)]);
});
for(const state of ['Inactive','Retired'])test(`OBSERVATION: ${state} Asset remains in picker`,async()=>{
  await Asset.updateOne({_id:assets['techA-A']._id},{$set:{status:state}});
  expect((await picker().expect(200)).body.find(x=>x._id===String(assets['techA-A']._id)).status).toBe(state);
});
test('OBSERVATION: actual admin-archived Asset remains in picker',async()=>{
  await request(app).patch(`/assets/${assets['techA-A']._id}/archive`).set(headers('admin')).send({}).expect(200);
  const row=(await picker().expect(200)).body.find(x=>x._id===String(assets['techA-A']._id));
  expect(row.status).toBe('Archived');expect(row.deletedAt).not.toBeNull();
});
for(const query of [{facilityId:'B'},{assignedTo:'B'},{search:'no-match'},{status:'Retired'},{'$or[0][facilityId]':'B'},{'facilityId[$ne]':'A'}])test(`OBSERVATION: unsupported query cannot override assignment or scope ${JSON.stringify(query)}`,async()=>{
  const expanded=Object.fromEntries(Object.entries(query).map(([k,v])=>[k,v==='A'?String(a):v==='B'?String(b):v]));
  expect(ids((await picker('techA','A',expanded).expect(200)).body)).toEqual(ids([assets['techA-A'],assets['techA-B']]));
});
for(const name of ['techA','admin'])test(`CONTROL: #5 ${name} attaches local equipment but rejects disclosed foreign equipment`,async()=>{
  const before=JSON.stringify(await WorkOrder.findById(wo._id).lean());
  await request(app).post(`/workorders/${wo._id}/test-equipment`).set(headers(name)).send({equipmentId:String(assets['techA-B']._id)}).expect(404);
  expect(JSON.stringify(await WorkOrder.findById(wo._id).lean())).toBe(before);
  await request(app).post(`/workorders/${wo._id}/test-equipment`).set(headers(name)).send({equipmentId:String(assets['techA-A']._id)}).expect(200);
  expect((await WorkOrder.findById(wo._id)).testEquipmentUsed).toHaveLength(1);
});
test('CONTROL: foreign selection cannot authorize attachment',async()=>{
  const before=JSON.stringify(await WorkOrder.findById(wo._id).lean());
  await request(app).post(`/workorders/${wo._id}/test-equipment`).set(headers('techA','B')).send({equipmentId:String(assets['techA-B']._id)}).expect(403);
  expect(JSON.stringify(await WorkOrder.findById(wo._id).lean())).toBe(before);
});
test('OBSERVATION: synthetic Facility authorization reduction retains assignment and leaks with fresh reduced claims',async()=>{
  await User.updateOne({_id:actors.techA.id},{$set:{facilities:[a,b]}});
  await User.updateOne({_id:actors.techA.id},{$set:{facilities:[a],facilityId:a}});
  const current=await User.findById(actors.techA.id).lean();expect(current.facilities.map(String)).toEqual([String(a)]);
  const r=await picker('techA','A',{}, {facilities:current.facilities.map(String),facilityId:String(current.facilityId)}).expect(200);
  expect(ids(r.body)).toContain(String(assets['techA-B']._id));
  expect(String((await Asset.findById(assets['techA-B']._id)).assignedTo)).toBe(String(actors.techA.id));
});
for(const field of ['assignedTo','facilityId'])test(`CONTROL: #6 ordinary Asset update rejects ${field} changes`,async()=>{
  const before=await Asset.findById(assets['techA-A']._id).lean();
  await request(app).put('/assets/'+assets['techA-A']._id).set(headers('admin')).send({[field]:String(field==='assignedTo'?actors.techB.id:b)}).expect(400);
  expect(await Asset.findById(assets['techA-A']._id).lean()).toEqual(before);
});
for(const selected of ['A','B',null,'not-a-facility','000000000000000000000099'])test(`SECURITY: A-only technician must not receive foreign equipment with selected ${selected??'missing'}`,async()=>{
  const r=await picker('techA',selected);expect(JSON.stringify(r.body)).not.toContain(String(assets['techA-B']._id));
});
for(const name of ['customer','viewer','legacy','missing','unknown'])test(`SECURITY: ${name} assignment must not grant foreign-Facility disclosure`,async()=>{
  const r=await picker(name,'A');expect(JSON.stringify(r.body)).not.toContain(String(assets[name+'-B']._id));
});
test('SECURITY: empty Facility claims must not grant assigned foreign Asset visibility',async()=>{
  const r=await picker('techA',null,{}, {facilities:[],facilityId:null});expect(JSON.stringify(r.body)).not.toContain(String(assets['techA-B']._id));
});
