import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

// Opt-in investigation, main 2f7bea8. Real mounted routes/auth/models; no real startup.
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const secret = 'synthetic-shared-archive-reproduction-only';
const oid = () => new mongoose.Types.ObjectId();
const roles = ['admin','technician','customer','viewer','tech','missing','unknown','anonymous','invalid','expired'];
const specs = [
  { key:'parts', model:'Part', router:'partRouter', archive:'archive', state:'Retired', business:'description' },
  { key:'manufacturers', model:'Manufacturer', router:'manufacturerRouter', archive:'archive', state:'Inactive', business:'contactName' },
  { key:'templates', model:'EquipmentTemplate', router:'templatesRouter', archive:'achive', state:'Archived', business:'description' },
];
let harness, app, models, facility, actor, admin, other, records, Asset, WorkOrder, Facility, User;
const observations = [];
const date = '2001-02-03T04:05:06.000Z';
jest.setTimeout(120000);
function headers(role='technician') {
  if (role==='anonymous') return {};
  if (role==='invalid') return {Authorization:'Bearer synthetic-invalid'};
  return {Authorization:`Bearer ${jwt.sign({sub:String(role==='admin'?admin:actor),
    ...(role==='missing'?{}:{role:role==='expired'?'technician':role}),facilityId:String(facility),facilities:[String(facility)]},
    secret,{issuer:'cronus.api',audience:'cronus.app',expiresIn:role==='expired'?-60:'10m'})}`,'x-facility-id':String(facility)};
}
const doc = s => models[s.key].findById(records[s.key]._id).lean();
const put = (s,body,role='technician',id=records[s.key]._id) => request(app).put(`/${s.key}/${id}`).set(headers(role)).send(body);
const archive = (s,role='admin',id=records[s.key]._id) => request(app).patch(`/${s.key}/${id}/${s.archive}`).set(headers(role)).send({});
const payload = s => ({status:s.state,deletedAt:date,deletedBy:String(other)});
function registeredApplication() {
  const captured=express();
  // app.js calls listen; suppress it without executing its startup callback.
  captured.listen=()=>{};
  const real={};
  for(const s of specs) real[`./src/routers/${s.router}`]=requireCore(`./src/routers/${s.router}.js`);
  real['./src/routers/assetsRouter']=requireCore('./src/routers/assetsRouter.js');
  real['./src/routers/workOrderRouter']=requireCore('./src/routers/workOrderRouter.js');
  const fakeRequire=name=>{
    if(real[name])return real[name];
    if(name==='./src/middleware/authMiddleware')return requireCore('./src/middleware/authMiddleware.js');
    if(name==='express')return Object.assign(()=>captured,express);
    if(name==='path')return path;
    if(name==='process')return {title:'synthetic'};
    if(name==='dotenv')return {config(){}};
    if(name==='debug')return ()=>()=>{};
    if(name.includes('/routers/')){const r=express.Router();r.supplierJsonErrorHandler=r.vendorJsonErrorHandler=r.contactJsonErrorHandler=r.followUpJsonErrorHandler=(_q,_s,next)=>next();return r;}
    if(name==='./src/middleware/forwardContractHeaders')return {attachContractClient:(_q,_s,next)=>next()};
    if(name.includes('/models/'))return {};
    if(name==='./src/config/db')return ()=>{};
    if(name==='./src/cronJobs/index')return {};
    if(['cors','morgan'].includes(name))return ()=>((_q,_s,next)=>next());
    if(name==='express-ejs-layouts')return (_q,_s,next)=>next();
    throw new Error('Unexpected startup dependency '+name);
  };
  vm.runInNewContext(readFileSync(new URL('../../../app.js',import.meta.url),'utf8'),{
    require:fakeRequire,__dirname:'/synthetic-no-public-files',process:{env:{}},console:{log(){}},
  });
  return captured;
}
beforeAll(async()=>{
  process.env.JWT_SECRET=secret;process.env.JWT_ISS='cronus.api';process.env.JWT_AUD='cronus.app';
  harness=await createIsolatedMongoHarness(mongoose);
  models=Object.fromEntries(specs.map(s=>[s.key,requireCore(`./src/models/${s.model}.js`)]));
  Asset=requireCore('./src/models/Asset.js');WorkOrder=requireCore('./src/models/WorkOrder.js');Facility=requireCore('./src/models/Facility.js');
  requireCore('./src/models/Supplier.js');User=requireCore('./src/models/User.js');
  // Deny provider/client traffic even if a future route accidentally invokes it.
  const axios=requireCore('axios');axios.defaults.adapter=async()=>{throw new Error('External HTTP prohibited in synthetic reproduction');};
  app=registeredApplication();
});
beforeEach(async()=>{
  for(const name of ['log','warn','error'])jest.spyOn(console,name).mockImplementation(()=>{});
  facility=oid();actor=oid();admin=oid();other=oid();
  await Facility.collection.insertOne({_id:facility,name:'Synthetic facility',organizationId:oid()});
  await User.collection.insertMany([{_id:actor,role:'technician',name:'Synthetic technician',facilities:[facility]},{_id:admin,role:'admin',name:'Synthetic admin',facilities:[facility]},{_id:other,role:'viewer',name:'Synthetic audit target',facilities:[facility]}]);
  records={};
  records.manufacturers=await models.manufacturers.create({name:'Synthetic maker',createdBy:admin});
  records.parts=await models.parts.create({partNumber:'SYNTHETIC-PART',description:'Synthetic part',price:4,quantityOnHand:9,manufacturerId:records.manufacturers._id,createdBy:admin});
  records.templates=await models.templates.create({manufacturer:'Synthetic maker',model:'Synthetic model',description:'Synthetic template'});
});
afterEach(async()=>{
  for(const model of Object.values(mongoose.models))await model.deleteMany({});
  jest.restoreAllMocks();
});
afterAll(async()=>{
  if(harness)await harness.stop();
  if(process.env.S3_OBSERVATIONS_FILE)writeFileSync(process.env.S3_OBSERVATIONS_FILE,JSON.stringify(observations,null,2));
});
test('CONTROL: configured and alternate Mongo targets fail closed',async()=>{
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('not issued');
  await expect(mongoose.connect('mongodb://127.0.0.1:1/forbidden')).rejects.toThrow('not issued');
});
for(const s of specs){
  for(const role of roles){
    test(`CONTROL: ${s.key} ordinary update role ${role}`,async()=>{
      const before=await doc(s);const r=await put(s,{[s.business]:'Synthetic edited'},role);
      expect(r.status).toBe(['admin','technician'].includes(role)?200:role==='anonymous'?401:403);
      const after=await doc(s);
      if(r.status===200)expect(after[s.business]).toBe('Synthetic edited');else expect(after).toEqual(before);
    });
    test(`CONTROL: ${s.key} dedicated archive role ${role}`,async()=>{
      const before=await doc(s);const r=await archive(s,role);
      expect(r.status).toBe(role==='admin'?200:role==='anonymous'?401:403);
      const after=await doc(s);
      if(role==='admin'){
        expect(after.status).toBe(s.state);
        if(s.key!=='templates'){expect(after.deletedAt).toBeInstanceOf(Date);expect(String(after.deletedBy)).toBe(String(admin));}
        else {expect(after.deletedAt).toBeUndefined();expect(after.deletedBy).toBeUndefined();expect(after.updatedBy).toBeUndefined();}
      }else expect(after).toEqual(before);
    });
  }
  for(const role of roles)for(const operation of ['simulate archive','reverse archive'])test(`CONTROL: ${s.key} protected-field role ${role} ${operation}`,async()=>{
    if(operation==='reverse archive')await archive(s).expect(200);
    const before=await doc(s);
    const body=operation==='simulate archive'?payload(s):{status:'Active',deletedAt:null,deletedBy:null};
    const r=await put(s,{...body,createdBy:String(other),updatedBy:String(other)},role);
    expect(r.status).toBe(['admin','technician'].includes(role)?200:role==='anonymous'?401:403);
    const after=await doc(s);
    if(r.status===200){
      expect(after.status).toBe(body.status);
      if(s.key!=='templates'){expect(after.deletedAt?.toISOString()??null).toBe(body.deletedAt);expect(String(after.createdBy)).toBe(String(other));}
    }else expect(after).toEqual(before);
  });
  for(const state of ['Active','Inactive','Pending','Retired','Archived'])test(`OBSERVATION: ${s.key} status-only ${state} is editable without deletion metadata`,async()=>{
    await put(s,{status:state}).expect(200);const d=await doc(s);expect(d.status).toBe(state);
    expect(d.deletedAt??null).toBeNull();
  });
  test(`OBSERVATION: ${s.key} invalid deletion date and audit identity`,async()=>{
    const before=await doc(s);const r=await put(s,{deletedAt:'not-a-date',deletedBy:'not-an-id'});
    expect(r.status).toBe(s.key==='templates'?200:500);
    if(s.key!=='templates')expect(await doc(s)).toEqual(before);
    else expect((await doc(s)).deletedAt).toBeUndefined();
  });
  test(`OBSERVATION: ${s.key} ordinary direct archive persists and reverses`,async()=>{
    await put(s,payload(s)).expect(200);let d=await doc(s);expect(d.status).toBe(s.state);
    if(s.key!=='templates'){expect(d.deletedAt.toISOString()).toBe(date);expect(String(d.deletedBy)).toBe(String(other));}
    await put(s,{status:'Active',deletedAt:null,deletedBy:null}).expect(200);d=await doc(s);expect(d.status).toBe('Active');
    if(s.key!=='templates'){expect(d.deletedAt).toBeNull();expect(d.deletedBy).toBeNull();}
  });
  test(`OBSERVATION: ${s.key} technician reverses actual admin archive`,async()=>{
    await archive(s).expect(200);await put(s,{status:'Active',deletedAt:null,deletedBy:null}).expect(200);
    const d=await doc(s);expect(d.status).toBe('Active');if(s.key!=='templates')expect(d.deletedAt).toBeNull();
  });
  for(const [kind,body] of [
    ['direct audit',()=>({createdBy:String(other),updatedBy:String(other),createdAt:date,updatedAt:date,__v:99})],
    ['$set',()=>({$set:{...payload(s),createdBy:String(other),updatedBy:String(other)}})],
    ['$unset',()=>({$unset:{status:1,deletedAt:1,deletedBy:1,createdBy:1}})],
    ['dotted path',()=>({'deletedAt.bad':date,'deletedBy.bad':String(other),'status.bad':s.state})],
    ['pipeline body',()=>[{$set:{status:s.state}}]],
    ['pipeline metadata',()=>[{$set:{status:s.state,deletedAt:date,deletedBy:String(other),createdBy:String(other),updatedBy:String(other),createdAt:date}}]],
    ['$rename',()=>({$rename:{[s.business]:'status'}})],
    ['invalid lifecycle',()=>({status:'Synthetic-invalid-status'})],
    ['unknown ownership',()=>({facilityId:String(other),tenantId:String(other),organizationId:String(other)})],
    ['replacement-like',()=>({[s.business]:'Synthetic replacement'})],
  ])test(`OBSERVATION: ${s.key} body semantics ${kind}`,async()=>{
    const before=await doc(s);const r=await put(s,body());const after=await doc(s);
    observations.push({resource:s.key,kind,http:r.status,before,after,response:r.body});
    expect(r.status).toBe(kind==='dotted path'?500:200);
    if(r.status>=400)expect(after).toEqual(before);
    if(kind==='direct audit'){
      expect(after.createdAt).toEqual(before.createdAt);expect(after.updatedAt.toISOString()).not.toBe(date);expect(after.__v).toBe(99);
      if(s.key!=='templates'){expect(String(after.createdBy)).toBe(String(other));expect(String(after.updatedBy)).toBe(String(actor));}
      else {expect(after.createdBy).toBeUndefined();expect(after.updatedBy).toBeUndefined();}
    }
    if(kind==='$set'){
      expect(after.status).toBe(s.state);
      if(s.key!=='templates'){expect(after.deletedAt.toISOString()).toBe(date);expect(String(after.deletedBy)).toBe(String(other));expect(String(after.updatedBy)).toBe(String(actor));}
    }
    if(kind==='$unset')expect(after.status).toBeUndefined();
    if(kind==='pipeline body')expect(after.status).toBe(s.key==='templates'?s.state:'Active');
    if(kind==='pipeline metadata'){
      if(s.key==='templates'){expect(after.status).toBe(s.state);expect(after.createdAt).toBe(date);expect(after.deletedAt).toBe(date);expect(after.createdBy).toBe(String(other));expect(after.deletedBy).toBe(String(other));expect(after.updatedBy).toBe(String(other));}
      else {expect(after.status).toBe('Active');expect(after.createdAt).toEqual(before.createdAt);expect(after.deletedAt).toBeNull();}
    }
    if(kind==='$rename'){
      if(s.key==='manufacturers')expect(after.status).toBe('Active'); // unset contactName source
      else {expect(after.status).toBe(before[s.business]);expect(after[s.business]).toBeUndefined();}
    }
    if(kind==='invalid lifecycle')expect(after.status).toBe('Synthetic-invalid-status');
    if(kind==='unknown ownership')for(const key of ['facilityId','tenantId','organizationId'])expect(after[key]).toBeUndefined();
    if(kind==='replacement-like'){expect(after.status).toBe('Active');expect(after[s.business]).toBe('Synthetic replacement');expect(after.createdAt).toEqual(before.createdAt);}

  });
  test(`OBSERVATION: ${s.key} query operator is ignored`,async()=>{
    await request(app).put(`/${s.key}/${records[s.key]._id}?status=Archived&$set[deletedAt]=${date}`).set(headers()).send({[s.business]:'Synthetic query control'}).expect(200);
    expect((await doc(s)).status).toBe('Active');
  });
  for(const [kind,id] of [['malformed','not-an-id'],['nonexistent','000000000000000000000099']]){
    test(`OBSERVATION: ${s.key} ${kind} ID ordinary/archive errors`,async()=>{
      const u=await put(s,{status:s.state},'technician',id);const a=await archive(s,'admin',id);
      observations.push({resource:s.key,kind,httpUpdate:u.status,update:u.body,httpArchive:a.status,archive:a.body});
      expect(u.status).toBe(kind==='malformed'?(s.key==='templates'?400:500):(s.key==='templates'?500:404));
      expect(a.status).toBe(kind==='malformed'?500:404);
      expect((await doc(s)).status).toBe('Active');
    });
  }
  for(const via of ['admin archive','technician bypass'])test(`OBSERVATION: ${s.key} reads and references after ${via}`,async()=>{
    const asset=await Asset.create({ctrlNumber:'SYNTHETIC-ASSET',manufacturer:'Synthetic maker',model:'Synthetic model',facilityId:facility,templateId:records.templates._id});
    const wo=await WorkOrder.create({assetId:asset._id,facilityId:facility,description:'Synthetic work',partsUsed:[{partId:records.parts._id,quantity:1,usedBy:actor}]});
    if(via==='admin archive')await archive(s).expect(200);else await put(s,payload(s)).expect(200);
    const list=await request(app).get(`/${s.key}`).set(headers()).expect(200);
    const rows=s.key==='templates'?list.body.templates:list.body;
    expect(rows.some(x=>x._id===String(records[s.key]._id))).toBe(true);
    if(s.key==='parts'){
      await request(app).post(`/workorders/${wo._id}/parts`).set(headers()).send({partId:String(records.parts._id),quantity:2}).expect(201);
      const history=await request(app).get(`/workorders/${wo._id}/parts`).set(headers()).expect(200);
      expect(history.body[0].partId._id).toBe(String(records.parts._id));
      expect((await WorkOrder.findById(wo._id)).partsUsed).toHaveLength(2);
    }else if(s.key==='manufacturers'){
      const history=await models.parts.findById(records.parts._id).populate('manufacturerId');expect(history.manufacturerId.name).toBe('Synthetic maker');
      await request(app).post('/parts').set(headers()).send({partNumber:'SYNTHETIC-NEW',description:'Synthetic new part',price:3,quantityOnHand:2,manufacturerId:String(records.manufacturers._id)}).expect(201);
      expect(String((await models.parts.findOne({partNumber:'SYNTHETIC-NEW'})).manufacturerId)).toBe(String(records.manufacturers._id));
    }else{
      await request(app).get(`/templates/${records.templates._id}`).set(headers()).expect(200);
      const distinct=await request(app).get('/templates/distinct/manufacturers').set(headers()).expect(200);expect(distinct.body).toContain('Synthetic maker');
      const history=await Asset.findById(asset._id).populate('templateId');expect(history.templateId.status).toBe('Archived');
      const made=await request(app).post('/assets').set(headers()).send({ctrlNumber:'SYNTHETIC-NEW',templateId:String(records.templates._id)}).expect(201);
      expect(await Asset.countDocuments({templateId:records.templates._id})).toBe(2);
    }
  });
  test(`SECURITY: ${s.key} technician must not persist administrator archive state via ordinary update`,async()=>{
    await put(s,payload(s));const d=await doc(s);
    if(s.key==='templates')expect(d.status).toBe('Active');
    else {expect(d.deletedAt).toBeNull();expect(d.deletedBy).toBeNull();}
  });
  test(`SECURITY: ${s.key} technician must not reverse administrator archive via ordinary update`,async()=>{
    await archive(s).expect(200);const before=await doc(s);
    await put(s,{status:'Active',deletedAt:null,deletedBy:null});const after=await doc(s);
    if(s.key==='templates')expect(after.status).toBe(s.state);
    else {expect(after.deletedAt).toEqual(before.deletedAt);expect(after.deletedBy).toEqual(before.deletedBy);}
  });
  if(s.key!=='templates')test(`SECURITY: ${s.key} technician must not rewrite creator or archive identity`,async()=>{
    await archive(s).expect(200);await put(s,{createdBy:String(other),deletedBy:String(other)});
    const d=await doc(s);expect(String(d.createdBy)).toBe(String(admin));expect(String(d.deletedBy)).toBe(String(admin));
  });
}

test('OBSERVATION: Template duplicate marker, verified flag and nested business path are editable',async()=>{
  const s=specs[2];await put(s,{duplicateOf:String(other),verified:true,'benchmark.notes':'Synthetic note'}).expect(200);
  const d=await doc(s);expect(String(d.duplicateOf)).toBe(String(other));expect(d.verified).toBe(true);expect(d.benchmark.notes).toBe('Synthetic note');
});
test('CONTROL: shared-resource schemas declare no Facility/tenant ownership',()=>{
  for(const m of Object.values(models))for(const key of ['facilityId','tenantId','organizationId'])expect(m.schema.path(key)).toBeUndefined();
});

test('SECURITY: Template ordinary update must preserve creation timestamp and reject injected archive audit metadata',async()=>{
  const s=specs[2],before=await doc(s);
  await put(s,[{$set:{createdAt:date,deletedAt:date,deletedBy:String(other),createdBy:String(other),updatedBy:String(other)}}]);
  const after=await doc(s);expect(after.createdAt).toEqual(before.createdAt);expect(after.deletedAt).toBeUndefined();
});
for(const s of specs){
  for(const role of roles)test(`CONTROL: ${s.key} list role ${role}`,async()=>{
    const r=await request(app).get('/'+s.key).set(headers(role));
    const expected=role==='anonymous'?401:['invalid','expired'].includes(role)?403:s.key==='templates'&&!['admin','technician'].includes(role)?403:200;
    expect(r.status).toBe(expected);
    if(expected===200)expect((s.key==='templates'?r.body.templates:r.body).some(x=>x._id===String(records[s.key]._id))).toBe(true);
  });
  test(`CONTROL: ${s.key} create role policy`,async()=>{
    for(const role of roles){
      const body=s.key==='parts'?{partNumber:'SYNTHETIC-'+role,description:'Synthetic created',price:1,quantityOnHand:1}:s.key==='manufacturers'?{name:'Synthetic '+role}:{manufacturer:'Synthetic '+role,model:'Synthetic '+role,description:'Synthetic created',equipmentClass:'Synthetic class'};
      const r=await request(app).post('/'+s.key).set(headers(role)).send(body);
      const allowed=role==='admin'||(role==='technician'&&s.key!=='templates');
      expect(r.status).toBe(allowed?201:role==='anonymous'?401:403);
    }
  });
  test(`CONTROL: ${s.key} no dedicated restore or hard delete; detail interface`,async()=>{
    await request(app).patch(`/${s.key}/${records[s.key]._id}/restore`).set(headers('admin')).send({}).expect(404);
    await request(app).delete(`/${s.key}/${records[s.key]._id}`).set(headers('admin')).expect(404);
    await request(app).get(`/${s.key}/${records[s.key]._id}`).set(headers()).expect(s.key==='templates'?200:404);
    expect(await models[s.key].countDocuments()).toBe(1);
  });
}
