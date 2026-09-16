import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const axios = requireCore('axios');
const { MongoClient } = requireCore('mongodb');
const secret = 'synthetic-alternate-ownership-only';
const di = '00000000000001';
const oldDate = '2001-01-01T00:00:00.000Z';
const oid = () => new mongoose.Types.ObjectId();
const str = x => String(x);
let harness, app, Asset, WorkOrder, Template, Facility, Department, a,b,da,db,aa,ab,actor,missing;
let calls, nativeCalls, closed, oldAdapter, seed=[];
jest.setTimeout(120000);
function headers(role='technician', selected=a, claims={}) {
 if(role==='anonymous')return {};
 if(role==='invalid')return {Authorization:'Bearer synthetic-invalid'};
 return {Authorization:`Bearer ${jwt.sign({sub:str(actor),facilityId:str(a),facilities:[str(a)],...(role==='missing'?{}:{role}),...claims},secret,{issuer:'cronus.api',audience:'cronus.app',expiresIn:role==='expired'?-60:'10m'})}`,...(selected?{'x-facility-id':str(selected)}:{})};
}
function create(extra={},role='technician',selected=a,top={}) {
 return request(app).post('/templates/from-di-or-udi').set(headers(role,selected)).send({di,udi:`(01)${di}(21)SYNTHETIC`,createAsset:true,asset:{ctrlNumber:'SYNTHETIC-NEW',facilityId:str(a),departmentId:str(da),...extra},...top});
}
const check4xx = r => {expect(r.status).toBeGreaterThanOrEqual(400);expect(r.status).toBeLessThan(500);};
const nativeCollection = () => mongoose.connection.db.collection('workOrders');
beforeAll(async()=>{
 process.env.JWT_SECRET=secret;process.env.JWT_ISS='cronus.api';process.env.JWT_AUD='cronus.app';
 process.env.FDA_GUDID_BASE='http://synthetic-gudid.invalid/api/v2';
 harness=await createIsolatedMongoHarness(mongoose);
 // Keep the actual admin database name. Only the issued ephemeral URI is reused.
 const issued=new URL(mongoose.connection.getClient().s.url);issued.pathname='/Cronus';
 await mongoose.disconnect();await mongoose.connect(issued.toString());
 [Asset,WorkOrder,Template,Facility,Department]=['Asset','WorkOrder','EquipmentTemplate','Facility','Department'].map(n=>requireCore(`./src/models/${n}.js`));
 oldAdapter=axios.defaults.adapter;
 axios.defaults.adapter=async config=>{
  calls.push(config.url);
  let data;
  if(config.method==='get' && config.url==='http://synthetic-gudid.invalid/api/v2/devices/lookup.json') {
   data={device:{di:config.params.di,companyName:'Synthetic provider',versionModelNumber:'Synthetic shared model',deviceDescription:'Synthetic device',productCode:'SYN'}};
  } else if(config.method==='get' && config.url==='https://api.fda.gov/device/classification.json?search=product_code:SYN') {
   data={results:[{device_class:'2',panel:'Synthetic',regulation_number:'Synthetic'}]};
  } else throw new Error('Unexpected provider request refused; no network fallback');
  return {data,status:200,statusText:'OK',headers:{},config};
 };
 // Never load actual seed values: only five synthetic rows matching inspected field/types.
 jest.doMock('../../data/workorders.json',()=>seed);
 app=express();app.use(express.json());
 app.use('/assets',requireCore('./src/routers/assetsRouter.js'));
 app.use('/templates',requireCore('./src/routers/templatesRouter.js'));
 app.use('/admin',requireCore('./src/routers/adminRouter.js'));
 app.use('/workorders',requireCore('./src/routers/workOrderRouter.js'));
 await Asset.init();
});
beforeEach(async()=>{
 for(const method of ['log','warn','error','dir'])jest.spyOn(console,method).mockImplementation(()=>{});
 calls=[];nativeCalls=[];closed=0;
 [a,b,da,db,aa,ab,actor,missing]=Array.from({length:8},oid);
 await Facility.collection.insertMany([{_id:a,name:'Synthetic A'},{_id:b,name:'Synthetic B'}]);
 await Department.create([{_id:da,facilityId:a,name:'Synthetic A department'},{_id:db,facilityId:b,name:'Synthetic B department'}]);
 await Asset.create([{_id:aa,facilityId:a,ctrlNumber:'SYNTHETIC-A',manufacturer:'Synthetic',model:'A',serialNumber:'SERIAL-A'},
 {_id:ab,facilityId:b,ctrlNumber:'SYNTHETIC-B',manufacturer:'Synthetic',model:'B',serialNumber:'SERIAL-B'}]);
 seed.splice(0,seed.length,...Array.from({length:5},(_,i)=>({assetId:str(i%2?ab:aa),description:`Synthetic seed ${i}`,status:'Open',scheduledDate:'2026-09-15',completionDate:i%2?null:'2026-09-16'})));
 jest.spyOn(MongoClient,'connect').mockImplementation(async uri=>{
  if(uri!==process.env.MONGO_URI || !uri.includes('configured-database-access-is-forbidden.invalid'))throw new Error('Native test target refused');
  nativeCalls.push('connect-intercepted');
  return {db(name){if(name!=='Cronus')throw new Error('Unexpected admin database');nativeCalls.push(name);return mongoose.connection.getClient().db(name);},async close(){closed++;}};
 });
});
afterEach(async()=>{
 for(const Model of Object.values(mongoose.models))await Model.deleteMany({});
 await nativeCollection().deleteMany({});jest.restoreAllMocks();
});
afterAll(async()=>{axios.defaults.adapter=oldAdapter;if(harness)await harness.stop();});

describe('UDI',()=>{
 test('CONTROL: real parsing/mapping uses only synthetic provider adapter',async()=>{const r=await create({},'technician',a,{di:undefined,udi:`(01)${di}(21)SYNTHETIC`}).expect(201);expect(r.body.asset.facilityId).toBe(str(a));expect(r.body.asset.departmentId).toBe(str(da));expect(calls).toHaveLength(3);});
 test('CONTROL: adapter refuses all unrecognized URLs',async()=>{await expect(axios.get('http://unexpected.invalid')).rejects.toThrow('Unexpected provider');});
 for(const role of ['admin','technician','customer','viewer','tech','missing','unknown','anonymous','invalid','expired'])test(`CONTROL: ${role} role gate`,async()=>{
  const allowed=['admin','technician'].includes(role);const r=await create({},role);expect(r.status).toBe(allowed?201:role==='anonymous'?401:403);if(!allowed){expect(calls).toHaveLength(0);expect(await Template.countDocuments()).toBe(0);}
 });
 for(const [name,status] of [['foreign',201],['missing',400],['malformed',400],['nonexistent',201]]) {
  const value=()=>name==='foreign'?str(b):name==='missing'?undefined:name==='malformed'?'bad-id':str(missing);
  test(`OBSERVATION: body Facility ${name}`,async()=>{const r=await create({facilityId:value()});expect(r.status).toBe(status);if(status===201)expect(r.body.asset.facilityId).toBe(value());expect(await Template.countDocuments()).toBe(1);});
  if(name!=='missing')test(`SECURITY: reject body Facility ${name}`,async()=>check4xx(await create({facilityId:value()})));
 }
 test('SECURITY: derive Facility from authorized context when body omits it',async()=>{const r=await create({facilityId:undefined}).expect(201);expect(r.body.asset.facilityId).toBe(str(a));});
 for(const name of ['missing','malformed','foreign','nonexistent']) {
  const sel=()=>name==='missing'?null:name==='malformed'?'bad-id':name==='foreign'?b:missing;
  test(`OBSERVATION: selected Facility ${name} ignored`,async()=>{await create({},'technician',sel()).expect(201);});
  test(`SECURITY: reject selected Facility ${name}`,async()=>check4xx(await create({},'technician',sel())));
 }
 test('CONTROL: same Facility Department retained',async()=>{const r=await create().expect(201);expect(r.body.asset.departmentId).toBe(str(da));});
 for(const name of ['foreign','nonexistent']) {
  test(`OBSERVATION: Department ${name} accepted`,async()=>{const r=await create({departmentId:str(name==='foreign'?db:missing)}).expect(201);expect(r.body.asset.departmentId).toBe(str(name==='foreign'?db:missing));});
  test(`SECURITY: reject Department ${name}`,async()=>check4xx(await create({departmentId:str(name==='foreign'?db:missing)})));
 }
 test('OBSERVATION: create audit is null despite canonical actor',async()=>{const r=await create().expect(201);expect(r.body.asset.createdBy).toBeNull();expect(r.body.asset.updatedBy).toBeNull();});
 test('SECURITY: canonical create audit required',async()=>{const r=await create().expect(201);expect(r.body.asset.createdBy).toBe(str(actor));expect(r.body.asset.updatedBy).toBe(str(actor));});
 for(const field of ['createdBy','updatedBy','deletedBy','deletedAt','createdAt','updatedAt','duplicateOf','metrics','workOrders'])test(`CONTROL: body ${field} spoof ignored`,async()=>{
  const v=field.endsWith('At')?oldDate:field==='metrics'?{totalMaintenanceCost:99999}:field==='workOrders'?[str(missing)]:str(missing);
  const r=await create({[field]:v}).expect(201);expect(r.body.asset[field]).not.toEqual(v);
 });
 test('OBSERVATION: foreign parent accepted',async()=>{const r=await create({parentAsset:str(ab)}).expect(201);expect(r.body.asset.parentAsset).toBe(str(ab));});
 test('SECURITY: foreign parent denied',async()=>check4xx(await create({parentAsset:str(ab)})));
 for(const serial of ['SERIAL-A','SERIAL-B'])test(`CONTROL: ${serial} does not expose duplicate Asset identifier`,async()=>{const r=await create({serialNumber:serial}).expect(201);expect(r.body.duplicateOf).toBeNull();expect(r.body.asset.duplicateOf).toBeNull();expect(JSON.stringify(r.body)).not.toContain(str(serial==='SERIAL-A'?aa:ab));});
 test('CONTROL: global ctrlNumber conflict has no foreign Asset ID',async()=>{const r=await create({ctrlNumber:'SYNTHETIC-B'}).expect(409);expect(JSON.stringify(r.body)).not.toContain(str(ab));});
 test('CONTROL: Template-only creation is shared and does not require Asset Facility',async()=>{const r=await create({},'technician',null,{createAsset:false}).expect(201);expect(r.body.asset).toBeUndefined();expect(r.body.template.facilityId).toBeUndefined();await request(app).get(`/templates/${r.body.template._id}`).set(headers('technician',b,{facilityId:str(b),facilities:[str(b)]})).expect(200);expect(await Asset.countDocuments()).toBe(2);});
 test('CONTROL: Template duplicate warning refers to shared Template, not foreign Asset',async()=>{const t=await Template.create({manufacturer:'Synthetic provider',model:'Synthetic shared model',di:'00000000000002'});const r=await create().expect(201);expect(r.body.duplicateOf).toBe(str(t._id));expect(r.body.asset.duplicateOf).toBeNull();});
 test('OBSERVATION: failed Asset creation leaves shared Template upsert',async()=>{await create({facilityId:undefined}).expect(400);expect(await Template.countDocuments()).toBe(1);expect(await Asset.countDocuments()).toBe(2);});
 test('OBSERVATION: malformed Facility exposes cast details',async()=>{const r=await create({facilityId:'bad-id'}).expect(400);expect(JSON.stringify(r.body)).toMatch(/Cast to ObjectId/);});
 test('SECURITY: malformed Facility must not expose cast internals',async()=>{const r=await create({facilityId:'bad-id'});expect(JSON.stringify(r.body)).not.toMatch(/Cast to ObjectId|BSONError|ValidationError/);});
});

describe('ADMIN',()=>{
 for(const role of ['anonymous','invalid','expired','customer','viewer','tech','missing','unknown','technician','admin'])test(`OBSERVATION: ${role} can invoke native insertion`,async()=>{
  const r=await request(app).get('/admin').set(headers(role)).expect(200);expect(r.body.insertedCount).toBe(5);expect(await nativeCollection().countDocuments()).toBe(5);expect(nativeCalls).toEqual(['connect-intercepted','Cronus']);expect(closed).toBe(1);
 });
 for(const role of ['anonymous','invalid','expired','customer','viewer','tech','missing','unknown','technician'])test(`SECURITY: ${role} cannot run mounted seed insertion`,async()=>{const r=await request(app).get('/admin').set(headers(role));check4xx(r);expect(await nativeCollection().countDocuments()).toBe(0);});
 test('CONTROL: native target rejects any unissued connection request',async()=>{await expect(MongoClient.connect('mongodb://127.0.0.1:27017/unsafe')).rejects.toThrow('Native test target refused');await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('Tests refused');});
 test('CONTROL: actual namespaces differ even in the same database',async()=>{await request(app).get('/admin').expect(200);expect(mongoose.connection.name).toBe('Cronus');expect(WorkOrder.collection.collectionName).toBe('workorders');expect(nativeCollection().collectionName).toBe('workOrders');expect(await WorkOrder.countDocuments()).toBe(0);expect(await nativeCollection().countDocuments()).toBe(5);const names=(await mongoose.connection.db.listCollections().toArray()).map(x=>x.name);expect(names).toEqual(expect.arrayContaining(['workorders','workOrders']));});
 test('CONTROL: inserted native ID is not an operational WO API record',async()=>{await request(app).get('/admin').expect(200);const d=await nativeCollection().findOne();await request(app).get(`/workorders/${d._id}`).set(headers('admin',null)).expect(404);const r=await request(app).get('/workorders').set(headers('admin',null)).expect(200);expect(JSON.stringify(r.body)).not.toContain(d.description);});
 test('OBSERVATION: native seed bypasses required ownership/audit/reference schema',async()=>{await request(app).get('/admin').expect(200);const docs=await nativeCollection().find().toArray();for(const d of docs){expect(typeof d.assetId).toBe('string');expect(d.facilityId).toBeUndefined();expect(d.createdBy).toBeUndefined();expect(d.createdAt).toBeUndefined();expect(new WorkOrder(d).validateSync().errors.facilityId).toBeDefined();}});
 test('OBSERVATION: repeat invocation reuses driver-added IDs and fails without extra records',async()=>{await request(app).get('/admin').expect(200);expect(seed.every(x=>x._id)).toBe(true);await request(app).get('/admin').expect(500);expect(await nativeCollection().countDocuments()).toBe(5);});
 test('OBSERVATION: fresh equivalent seed objects add more records without uniqueness guard',async()=>{await request(app).get('/admin').expect(200);seed.splice(0,seed.length,...seed.map(({_id,...rest})=>({...rest})));await request(app).get('/admin').expect(200);expect(await nativeCollection().countDocuments()).toBe(10);});
});

describe('UDI',()=>{
 test('OBSERVATION: DI-only Asset creation fails after Template upsert',async()=>{const r=await create({},'technician',a,{udi:undefined}).expect(500);expect(r.body.error).toMatch(/Cannot read properties of undefined/);expect(await Template.countDocuments()).toBe(1);expect(await Asset.countDocuments()).toBe(2);});
 test('SECURITY: valid DI-only creation should not fail internally',async()=>{await create({},'technician',a,{udi:undefined}).expect(201);});
 test('CONTROL: DI-only Template creation remains supported',async()=>{await create({},'technician',null,{udi:undefined,createAsset:false}).expect(201);});
});
