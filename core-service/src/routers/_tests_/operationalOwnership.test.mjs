import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose'), axios = requireCore('axios');
const secret = 'synthetic-permanent-ownership';
const oid = () => new mongoose.Types.ObjectId(), str = x => String(x);
let harness, app, Asset, WO, Facility, Department, User, Ticket, Template, Procedure, Counter;
let a,b,da,db,aa,ab,ua,ub,wa,wb,ticket,requester,missing,adapter,providerCalls;
const oldDate='2001-01-01T00:00:00.000Z';
jest.setTimeout(120000);
function headers(role='technician', selected=a, claims={}) {
 if(role==='anonymous')return {};
 if(role==='invalid')return {Authorization:'Bearer invalid-synthetic'};
 return {Authorization:`Bearer ${jwt.sign({sub:str(ua),facilityId:str(a),facilities:[str(a)],...(role==='missing'?{}:{role}),...claims},secret,{issuer:'cronus.api',audience:'cronus.app',expiresIn:role==='expired'?-60:'10m'})}`,...(selected?{'x-facility-id':str(selected)}:{})};
}
const send=(method,url,body,role='technician',selected=a,claims={})=>request(app)[method](url).set(headers(role,selected,claims)).send(body);
const assetBody=x=>({ctrlNumber:'SYNTHETIC-NEW',manufacturer:'Synthetic',model:'Device',...x});
const woBody=x=>({description:'Synthetic new work',assetId:str(aa),...x});
const udiBody=x=>({di:'00000000000001',createAsset:true,asset:assetBody(x)});
const safe=r=>{expect(r.status).toBeGreaterThanOrEqual(400);expect(r.status).toBeLessThan(500);expect(JSON.stringify(r.body)).not.toMatch(/CastError|Cast to|BSONError|mongoose|stack|\.js:\d|Cannot read properties/i);};
const doc=(M,id)=>M.findById(id).lean();
beforeAll(async()=>{
 process.env.JWT_SECRET=secret;process.env.JWT_ISS='cronus.api';process.env.JWT_AUD='cronus.app';process.env.FDA_GUDID_BASE='http://synthetic-provider.invalid';process.env.CONTRACT_API_URL='http://synthetic-contract.invalid';
 harness=await createIsolatedMongoHarness(mongoose,{replicaSet:true});
 [Asset,WO,Facility,Department,User,Ticket,Template,Procedure,Counter]=['Asset','WorkOrder','Facility','Department','User','Tickets','EquipmentTemplate','Procedure','Counter'].map(n=>requireCore(`./src/models/${n}.js`));
 adapter=axios.defaults.adapter;
 axios.defaults.adapter=async config=>{
  let data;
  if(config.url.startsWith('/contracts/active-for-asset/'))data={contractId:null};
  else if(config.url==='http://synthetic-provider.invalid/devices/lookup.json'){providerCalls++;data={device:{di:config.params.di,companyName:'Synthetic provider',versionModelNumber:'Synthetic model',deviceDescription:'Synthetic'}};}
  else throw new Error('Unexpected network request refused');
  return {data,status:200,statusText:'OK',headers:{},config};
 };
 app=express();app.use(express.json());app.use('/assets',requireCore('./src/routers/assetsRouter.js'));app.use('/workorders',requireCore('./src/routers/workOrderRouter.js'));app.use('/templates',requireCore('./src/routers/templatesRouter.js'));
 // Initialize the collections used by the transaction; do not rebuild unrelated indexes.
 await Promise.all([Asset, WO, Ticket, Counter].map(m=>m.init()));
});
beforeEach(async()=>{
 for(const method of ['log','error','warn','dir'])jest.spyOn(console,method).mockImplementation(()=>{});
 [a,b,da,db,aa,ab,ua,ub,wa,wb,requester,missing]=Array.from({length:12},oid);providerCalls=0;
 await Facility.collection.insertMany([{_id:a,name:'Synthetic A'},{_id:b,name:'Synthetic B'}]);
 await Department.create([{_id:da,facilityId:a,name:'A department'},{_id:db,facilityId:b,name:'B department'}]);
 await User.collection.insertMany([{_id:ua,username:'A technician',email:'a@example.invalid',role:'technician',facilities:[a]},{_id:ub,username:'PRIVATE B user',email:'b@example.invalid',role:'technician',facilities:[b]},{_id:requester,username:'Customer requester',email:'requester@example.invalid',role:'customer',facilities:[a]}]);
 await Asset.create([{_id:aa,facilityId:a,departmentId:da,ctrlNumber:'A',manufacturer:'Synthetic',model:'A',serialNumber:'A-SERIAL'},{_id:ab,facilityId:b,departmentId:db,ctrlNumber:'B',manufacturer:'Synthetic',model:'B',serialNumber:'B-SERIAL'}]);
 await WO.create([{_id:wa,facilityId:a,assetId:aa,description:'A work',workOrderNumber:1},{_id:wb,facilityId:b,assetId:ab,description:'PRIVATE-B-WORK',workOrderNumber:2}]);
 ticket=await Ticket.create({facilityId:a,departmentId:da,assetId:aa,type:'service',status:'Approved',subject:'Synthetic ticket',requestedBy:requester});
});
afterEach(async()=>{jest.restoreAllMocks();for(const M of Object.values(mongoose.models))await M.deleteMany({});});
afterAll(async()=>{axios.defaults.adapter=adapter;if(harness)await harness.stop();});

for(const route of ['assets','udi','workorders']) {
 const create=(body={},role='technician',selected=a)=>send('post',route==='udi'?'/templates/from-di-or-udi':`/${route}`,route==='assets'?assetBody(body):route==='udi'?udiBody(body):woBody(body),role,selected);
 for(const role of ['admin','technician','customer','viewer','tech','missing','unknown','anonymous','invalid','expired'])test(`${route}: ${role} create role`,async()=>{
  const r=await create({},role);expect(r.status).toBe(['admin','technician'].includes(role)?201:role==='anonymous'?401:403);
 });
 for(const mode of ['missing','malformed','unauthorized','nonexistent'])test(`${route}: ${mode} selected Facility fails safely`,async()=>{
  const selected=mode==='missing'?null:mode==='malformed'?'bad-id':mode==='unauthorized'?b:missing;
  safe(await create({},mode==='nonexistent'?'admin':'technician',selected));
 });
 test(`${route}: body cannot select foreign Facility`,async()=>safe(await create({facilityId:str(b)})));
 test(`${route}: matching body Facility accepted`,async()=>{const r=await create({facilityId:str(a)}).expect(201);expect((r.body.asset||r.body).facilityId).toBe(str(a));});
 test(`${route}: same Department accepted`,async()=>{const r=await create({departmentId:str(da)}).expect(201);expect((r.body.asset||r.body).departmentId).toBe(str(da));});
 for(const value of ['foreign','missing','malformed'])test(`${route}: ${value} Department fails without details`,async()=>{
  const r=await create({departmentId:value==='foreign'?str(db):value==='missing'?str(missing):'bad-id'});safe(r);expect(JSON.stringify(r.body)).not.toContain(str(db));
 });
 test(`${route}: creation stamps canonical audit and no client costs`,async()=>{const r=await create().expect(201);const d=r.body.asset||r.body;expect(d.createdBy).toBe(str(ua));expect(d.updatedBy).toBe(str(ua));});
}
for(const role of ['admin','technician']) for(const field of ['facilityId','createdBy','updatedBy','createdAt','updatedAt','deletedAt','deletedBy','metrics','duplicateOf','workOrders','assignedTo','contractId','$set','metrics.totalMaintenanceCost'])test(`Asset PUT ${role} blocks ${field}`,async()=>{
 const before=JSON.stringify(await doc(Asset,aa));safe(await send('put',`/assets/${aa}`,{[field]:str(b)},role));expect(JSON.stringify(await doc(Asset,aa))).toBe(before);
});
test('Asset legitimate edit and validated shared references',async()=>{
 const t=await Template.create({manufacturer:'Synthetic',model:'Shared'});const p=await Procedure.create({name:'Shared procedure',tasks:[]});
 const edited=await send('put',`/assets/${aa}`,{description:'Edited',departmentId:str(da),templateId:str(t._id),purchaseCost:5,maintenanceSchedule:{procedure:str(p._id),intervalMonths:12}});
 expect(edited.status).toBe(200);
 expect((await doc(Asset,aa)).description).toBe('Edited');
});
for(const field of ['departmentId','parentAsset','templateId'])for(const value of ['missing','malformed'])test(`Asset PUT ${field} ${value} safe`,async()=>safe(await send('put',`/assets/${aa}`,{[field]:value==='missing'?str(missing):'bad-id'})));
for(const field of ['departmentId','parentAsset'])test(`Asset PUT foreign ${field} denied`,async()=>safe(await send('put',`/assets/${aa}`,{[field]:str(field==='departmentId'?db:ab)})));
test('Asset parent unlink is safe and scoped',async()=>{await send('delete',`/assets/${aa}/parent`).expect(200);await send('delete',`/assets/${ab}/parent`).expect(404);});
test('Asset detail filters historical foreign Work Order links',async()=>{
 await Asset.updateOne({_id:aa},{$set:{workOrders:[wa,wb]}});
 for(const [role,selected] of [['technician',a],['admin',null]]){
  const r=await send('get',`/assets/${aa}`,undefined,role,selected).expect(200);expect(r.body.workOrders.map(x=>x._id)).toEqual([str(wa)]);expect(JSON.stringify(r.body)).not.toContain('PRIVATE-B-WORK');
 }
});
for(const route of ['assets','udi'])test(`${route}: foreign duplicate serial private`,async()=>{
 const r=await send('post',route==='assets'?'/assets':'/templates/from-di-or-udi',route==='assets'?assetBody({serialNumber:'B-SERIAL'}):udiBody({serialNumber:'B-SERIAL'})).expect(201);expect(JSON.stringify(r.body)).not.toContain(str(ab));
});
test('ordinary Asset visible duplicate advisory preserved',async()=>{const r=await send('post','/assets',assetBody({serialNumber:'A-SERIAL'})).expect(201);expect(r.body.duplicateOf).toBe(str(aa));});
test('UDI DI-only creation derives selected ownership',async()=>{const r=await send('post','/templates/from-di-or-udi',udiBody({})).expect(201);expect(r.body.asset.facilityId).toBe(str(a));expect(providerCalls).toBe(1);});
test('UDI Template-only semantics stay shared',async()=>{const r=await send('post','/templates/from-di-or-udi',{di:'00000000000001',createAsset:false},'technician',null).expect(201);expect(r.body.template.facilityId).toBeUndefined();});
test('UDI validates ownership before provider or Template mutation',async()=>{await send('post','/templates/from-di-or-udi',udiBody({facilityId:str(b)})).expect(400);expect(providerCalls).toBe(0);expect(await Template.countDocuments()).toBe(0);});
for(const field of ['createdBy','updatedBy','createdAt','updatedAt','deletedBy','deletedAt','metrics','duplicateOf','workOrders'])for(const route of ['assets','udi'])test(`${route}: ignores ${field} create spoof`,async()=>{const value=field.endsWith('At')?oldDate:str(ub);const r=await send('post',route==='assets'?'/assets':'/templates/from-di-or-udi',route==='assets'?assetBody({[field]:value}):udiBody({[field]:value})).expect(201);expect(r.body.asset[field]).not.toBe(value);});
for(const field of ['timeLogs','travelLogs','partsUsed','testEquipmentUsed','procedures','costs','createdBy','updatedBy','createdAt','updatedAt','deletedAt','deletedBy','createdFrom','ticketId','workOrderNumber','$set','timeLogs.0.userId'])test(`WO creation blocks ${field}`,async()=>{safe(await send('post','/workorders',woBody({[field]:str(ub)})));expect(await WO.countDocuments()).toBe(2);});
for(const asset of ['foreign','missing','malformed'])test(`WO ${asset} Asset non-disclosing`,async()=>{const r=await send('post','/workorders',woBody({assetId:asset==='foreign'?str(ab):asset==='missing'?str(missing):'bad-id'}));safe(r);expect(JSON.stringify(r.body)).not.toContain(str(ab));});
for(const role of ['admin','technician','customer','viewer','tech','missing','unknown'])for(const action of ['create','assign'])test(`WO ${action} assignee role ${role}`,async()=>{
 await User.collection.updateOne({_id:ua},role==='missing'?{$unset:{role:1}}:{$set:{role}});
 const r=await send(action==='create'?'post':'patch',action==='create'?'/workorders':`/workorders/${wa}/assign`,action==='create'?woBody({assignedTo:str(ua)}):{assignedTo:str(ua)});
 expect(r.status).toBe(['admin','technician'].includes(role)?action==='create'?201:200:404);
});
for(const action of ['create','assign'])for(const value of ['foreign','missing','malformed'])test(`WO ${action} assignee ${value} denied`,async()=>{
 const assignedTo=value==='foreign'?str(ub):value==='missing'?str(missing):'bad-id';safe(await send(action==='create'?'post':'patch',action==='create'?'/workorders':`/workorders/${wa}/assign`,action==='create'?woBody({assignedTo}):{assignedTo}));
});
test('ordinary WO requester remains distinct and manual provenance fixed',async()=>{const r=await send('post','/workorders',woBody({requestedBy:str(requester)})).expect(201);expect(r.body.requestedBy).toBe(str(requester));expect(r.body.createdBy).toBe(str(ua));expect(r.body.createdFrom).toBe('manual');expect(r.body.ticketId).toBeNull();});
for(const route of ['assets','workorders'])test(`${route}: admin archive idempotent, technician denied`,async()=>{
 const target=route==='assets'?aa:wa;await send('patch',`/${route}/${target}/archive`,{}).expect(403);
 await send('patch',`/${route}/${target}/archive`,{},'admin').expect(200);const before=await doc(route==='assets'?Asset:WO,target);
 await send('patch',`/${route}/${target}/archive`,{},'admin').expect(200);const after=await doc(route==='assets'?Asset:WO,target);expect(after.deletedAt).toEqual(before.deletedAt);expect(str(after.deletedBy)).toBe(str(ua));
});
test('WO archive status cannot bypass dedicated admin route',async()=>{await send('patch',`/workorders/${wa}/status`,{status:'Archived'}).expect(400);await send('post','/workorders',woBody({status:'archived'})).expect(400);});
test('dedicated equipment still validates same Facility',async()=>{await send('post',`/workorders/${wa}/test-equipment`,{equipmentId:str(aa)}).expect(200);await send('post',`/workorders/${wa}/test-equipment`,{equipmentId:str(ab)}).expect(404);});

const promote=(body={},role='technician',target=ticket._id)=>send('post',`/workorders/from-ticket/${target}`,body,role);
test('promotion transaction commits exactly one WO and correct provenance/backlink',async()=>{
 const r=await promote().expect(201);const t=await doc(Ticket,ticket._id);expect(t.status).toBe('Converted');expect(str(t.workOrderId)).toBe(r.body.workOrder._id);expect(await WO.countDocuments({ticketId:ticket._id})).toBe(1);
 const w=await doc(WO,t.workOrderId);expect(str(w.assetId)).toBe(str(aa));expect(str(w.facilityId)).toBe(str(a));expect(str(w.departmentId)).toBe(str(da));expect(str(w.requestedBy)).toBe(str(requester));expect(w.createdFrom).toBe('ticket');expect(str(w.createdBy)).toBe(str(ua));expect(str(w.updatedBy)).toBe(str(ua));expect(str(t.updatedBy)).toBe(str(ua));
});
for(const status of ['Open','Needs Info','Converted','Rejected','Closed'])test(`promotion rejects ${status}`,async()=>{await Ticket.updateOne({_id:ticket._id},{$set:{status}});safe(await promote());expect(await WO.countDocuments()).toBe(2);});
for(const change of ['existing WO','assetless','foreign Ticket','foreign Asset','missing Asset','foreign Department','deleted Ticket'])test(`promotion ${change} rejected without partial state`,async()=>{
 const patch={'existing WO':{workOrderId:wa},assetless:{assetId:null},'foreign Ticket':{facilityId:b},'foreign Asset':{assetId:ab},'missing Asset':{assetId:missing},'foreign Department':{departmentId:db},'deleted Ticket':{deletedAt:new Date()}}[change];await Ticket.updateOne({_id:ticket._id},{$set:patch});safe(await promote());expect(await WO.countDocuments()).toBe(2);expect((await doc(Ticket,ticket._id)).status).toBe('Approved');
});
for(const field of ['assetId','facilityId','createdBy','createdFrom','requestedBy','ticketId'])test(`promotion rejects conflicting/client ${field}`,async()=>{safe(await promote({[field]:str(b)}));expect(await WO.countDocuments()).toBe(2);});
for(const role of ['customer','viewer','tech','missing','unknown','anonymous','invalid','expired'])test(`promotion rejects ${role}`,async()=>{expect((await promote({},role)).status).toBe(role==='anonymous'?401:403);});
for(const value of ['bad-id','missing'])test(`promotion ${value} Ticket safe`,async()=>safe(await promote({},'technician',value==='missing'?missing:value)));
test('WO validation failure rolls back promotion',async()=>{
 await Ticket.collection.updateOne({_id:ticket._id},{$set:{priority:'invalid-schema-value'}});safe(await promote());const t=await doc(Ticket,ticket._id);expect(t.status).toBe('Approved');expect(t.workOrderId).toBeNull();expect(await WO.countDocuments()).toBe(2);
});
test('Ticket save failure rolls back Work Order and counter',async()=>{
 const before=await Counter.find().lean();jest.spyOn(Ticket.prototype,'save').mockRejectedValueOnce(new Error('Synthetic transaction failure'));
 await promote().expect(500);expect(await WO.countDocuments()).toBe(2);const t=await doc(Ticket,ticket._id);expect(t.status).toBe('Approved');expect(t.workOrderId).toBeNull();expect(await Counter.find().lean()).toEqual(before);
});
test('concurrent and repeated promotion cannot duplicate Work Orders',async()=>{
 const responses=await Promise.all([promote(),promote()]);expect(responses.map(r=>r.status).sort()).toEqual([201,409]);await promote().expect(409);expect(await WO.countDocuments({ticketId:ticket._id})).toBe(1);
});
test('replica harness rejects configured or arbitrary database target',async()=>{await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('Tests refused');await expect(mongoose.connect('mongodb://127.0.0.1:27017/unsafe')).rejects.toThrow('Tests refused');});
test('actual application registration has no admin import/mount or endpoint',async()=>{
 const source=readFileSync(new URL('../../../app.js',import.meta.url),'utf8');const captured=express();const mounted=[];
 const use=captured.use.bind(captured);captured.use=(...args)=>{if(typeof args[0]==='string')mounted.push(args[0]);return use(...args);};captured.listen=()=>{};
 const fakeExpress=Object.assign(()=>captured,express);
 const fakeRequire=name=>{
  if(name.includes('adminRouter'))throw new Error('Admin seed router must not be imported');
  if(name==='express')return fakeExpress;if(name==='path')return path;if(name==='process')return {title:'test'};
  if(name==='dotenv')return {config(){}};if(name==='debug')return ()=>()=>{};
  if(name.includes('/routers/')){ const r=express.Router();r.supplierJsonErrorHandler=r.vendorJsonErrorHandler=r.contactJsonErrorHandler=r.followUpJsonErrorHandler=r.interactionJsonErrorHandler=(_q,_s,next)=>next();return r; }if(name.includes('/middleware/'))return {authenticateToken:(_q,_s,next)=>next()};
  if(name.includes('/models/'))return {};if(name.includes('/config/db'))return ()=>{};if(name.includes('/cronJobs/'))return {};
  if(['morgan','cors'].includes(name))return ()=>((_req,_res,next)=>next());
  if(name==='express-ejs-layouts')return (_req,_res,next)=>next();throw new Error('Unexpected startup dependency '+name);
 };
 vm.runInNewContext(source,{require:fakeRequire,__dirname:'/synthetic',process:{env:{}},console:{log(){}}});
 expect(mounted).not.toContain('/admin');await request(captured).get('/admin').expect(404);
});

test('admin creator without assignment eligibility can create unassigned work',async()=>{
 await User.updateOne({_id:ua},{$set:{role:'admin',facilities:[]}});
 const r=await send('post','/workorders',woBody({}),'admin').expect(201);expect(r.body.assignedTo).toBeUndefined();
});
test('admin assignee still requires explicit Facility membership',async()=>{
 await User.updateOne({_id:ub},{$set:{role:'admin',facilities:[]}});
 await send('post','/workorders',woBody({assignedTo:str(ub)}),'admin').expect(404);
});

for (const field of ['di','udi','ctrlNumber']) test(`UDI malformed ${field} fails before provider`,async()=>{
 const body=udiBody({});if(field==='ctrlNumber')body.asset.ctrlNumber=123;else body[field]={bad:true};
 await send('post','/templates/from-di-or-udi',body).expect(400);expect(providerCalls).toBe(0);
});

test('Asset deletedAt spoof leaves the null field unchanged',async()=>{
 expect((await doc(Asset,aa)).deletedAt).toBeNull();
 await send('put',`/assets/${aa}`,{deletedAt:oldDate}).expect(400);
 expect((await doc(Asset,aa)).deletedAt).toBeNull();
});
test('transaction rollback preserves an existing global Counter sequence',async()=>{
 await Counter.create({_id:'wo:global',seq:50});
 jest.spyOn(Ticket.prototype,'save').mockRejectedValueOnce(new Error('Synthetic rollback'));
 await promote().expect(500);
 expect((await Counter.findById('wo:global')).seq).toBe(50);
 expect(await WO.countDocuments({ticketId:ticket._id})).toBe(0);
 expect((await doc(Ticket,ticket._id)).status).toBe('Approved');
});
test('concurrent distinct Ticket promotions allocate distinct committed global numbers',async()=>{
 await Counter.create({_id:'wo:global',seq:50});
 const other=await Ticket.create({facilityId:a,assetId:aa,type:'service',status:'Approved',subject:'Second synthetic ticket',requestedBy:requester});
 const results=await Promise.all([promote(),promote({},'technician',other._id)]);
 expect(results.map(r=>r.status)).toEqual([201,201]);
 expect(results.map(r=>r.body.workOrder.workOrderNumber).sort()).toEqual([51,52]);
 expect((await Counter.findById('wo:global')).seq).toBe(52);
 expect(await WO.countDocuments({ticketId:{$in:[ticket._id,other._id]}})).toBe(2);
});

test('transient transaction retry commits one Work Order and one counter increment',async()=>{
 await Counter.create({_id:'wo:global',seq:50});
 const error=new mongoose.mongo.MongoServerError({errmsg:'Synthetic transient conflict',code:112});
 error.addErrorLabel('TransientTransactionError');
 jest.spyOn(Ticket.prototype,'save').mockRejectedValueOnce(error);
 const response=await promote().expect(201);
 expect(await WO.countDocuments({ticketId:ticket._id})).toBe(1);
 expect((await Counter.findById('wo:global')).seq).toBe(51);
 const stored=await doc(Ticket,ticket._id);expect(stored.status).toBe('Converted');expect(str(stored.workOrderId)).toBe(response.body.workOrder._id);
});
