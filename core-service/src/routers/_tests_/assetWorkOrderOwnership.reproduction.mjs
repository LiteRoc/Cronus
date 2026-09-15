import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

// Reproduction only. SECURITY tests intentionally retain the required boundary.
// OBSERVATION tests describe current behavior, not approved future policy.
const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const axios = requireCore('axios');
const secret = 'synthetic-asset-workorder-ownership-only';
const oldDate = '2001-01-01T00:00:00.000Z';
let app, harness, models, Asset, WorkOrder, Facility, Department, Template, User, Ticket;
let a, b, aa, ab, wa, wb, da, db, template, ua, ub, users, missing, calls, adapter, originalAdapter;
let contractReply = null;
const oid = () => new mongoose.Types.ObjectId();
const s = x => String(x);
const roles = ['admin', 'technician', 'customer', 'viewer', 'tech', 'missing', 'unknown', 'anonymous', 'invalid', 'expired'];
jest.setTimeout(120000);
function headers(role = 'technician', selected = a, claims = {}) {
  if (role === 'anonymous') return {};
  if (role === 'invalid') return { Authorization: 'Bearer invalid-synthetic-token', 'x-facility-id': s(selected) };
  const payload = { sub: s(ua), facilityId: s(a), facilities: [s(a)], ...(role === 'missing' ? {} : {role}), ...claims };
  const token = jwt.sign(payload, secret, { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: role === 'expired' ? -60 : '10m' });
  return { Authorization: `Bearer ${token}`, ...(selected ? {'x-facility-id': s(selected)} : {}) };
}
const assetBody = extra => ({ctrlNumber: 'NEW-SYNTHETIC', manufacturer: 'Synthetic', model: 'Device', facilityId: s(a), ...extra});
const woBody = extra => ({assetId: s(aa), description: 'Synthetic new WO', ...extra});
const row = (Model, id) => Model.collection.findOne({_id: id});
const snap = async (Model, id) => JSON.stringify(await row(Model, id));
const send = (method, path, body, role = 'technician', selected = a, claims = {}) => request(app)[method](path).set(headers(role, selected, claims)).send(body);
const createAsset = (extra = {}, role = 'technician', selected = a, claims = {}) => send('post', '/assets', assetBody(extra), role, selected, claims);
const createWO = (extra = {}, role = 'technician', selected = a, claims = {}) => send('post', '/workorders', woBody(extra), role, selected, claims);
const security = (name, fn) => test(`SECURITY: ${name}`, fn);
const observe = (name, fn) => test(`OBSERVATION: ${name}`, fn);
const control = (name, fn) => test(`CONTROL: ${name}`, fn);
const denied = response => expect(response.status).toBeGreaterThanOrEqual(400);
const safe4xx = response => { expect(response.status).toBeGreaterThanOrEqual(400); expect(response.status).toBeLessThan(500); expect(JSON.stringify(response.body)).not.toMatch(/CastError|Cast to ObjectId|BSONError|ValidationError|mongoose|\.js:\d|stack|@@iterator|Symbol\(Symbol.iterator\)/i); };
beforeAll(async () => {
  process.env.JWT_SECRET = secret; process.env.JWT_ISS = 'cronus.api'; process.env.JWT_AUD = 'cronus.app';
  process.env.CONTRACT_API_URL = 'http://synthetic-contract.invalid';
  harness = await createIsolatedMongoHarness(mongoose);
  [Asset, WorkOrder, Facility, Department, Template, User, Ticket] = ['Asset','WorkOrder','Facility','Department','EquipmentTemplate','User','Tickets'].map(name => requireCore(`./src/models/${name}.js`));
  requireCore('./src/models/Procedure.js'); requireCore('./src/models/Task.js');
  originalAdapter = axios.defaults.adapter;
  adapter = async config => {
    // No native HTTP adapter can be reached, including for an unexpected request.
    if (config.baseURL !== 'http://synthetic-contract.invalid' || config.method !== 'get' || !/^\/contracts\/active-for-asset\/[a-f\d]{24}$/.test(config.url)) throw new Error('Unexpected synthetic contract request refused');
    calls.push({ url: config.url, selected: config.headers['x-facility-id'], authorized: Boolean(config.headers.Authorization) });
    if (contractReply === 'unavailable') throw new Error('Synthetic contract unavailable');
    return {data: {contractId: contractReply}, status: 200, statusText: 'OK', headers: {}, config};
  };
  axios.defaults.adapter = adapter;
  app = express(); app.use(express.json());
  // Same router import order as app.js; never import app.js, DB startup, jobs or listeners.
  app.use('/assets', requireCore('./src/routers/assetsRouter.js'));
  app.use('/workorders', requireCore('./src/routers/workOrderRouter.js'));
  models = Object.values(mongoose.models);
  await Asset.init();
});
beforeEach(async () => {
  for (const method of ['log','warn','error','dir']) jest.spyOn(console, method).mockImplementation(() => {});
  calls = []; contractReply = null;
  [a,b,aa,ab,wa,wb,da,db,ua,ub,missing] = Array.from({length:11}, oid);
  await Facility.collection.insertMany([{_id:a,name:'Synthetic A',organizationId:oid()},{_id:b,name:'Synthetic B',organizationId:oid()}]);
  await Department.create([{_id:da,name:'Synthetic A department',facilityId:a},{_id:db,name:'Private B department',facilityId:b}]);
  users = Object.fromEntries(['technician','customer','viewer','tech','missing','unknown'].map(role => [role,oid()]));
  await User.collection.insertMany([
    {_id:ua,username:'Synthetic A technician',email:'a@example.invalid',role:'technician',facilities:[a],facilityId:a},
    {_id:ub,username:'Private B technician',email:'b@example.invalid',role:'technician',facilities:[b],facilityId:b},
    ...Object.entries(users).map(([role,_id]) => ({_id,username:`Synthetic ${role}`,email:`${role}@example.invalid`,...(role==='missing'?{}:{role}),facilities:[a],facilityId:a})),
  ]);
  template = await Template.create({manufacturer:'Synthetic template maker',model:'Shared template'});
  await Asset.create([{_id:aa,facilityId:a,departmentId:da,ctrlNumber:'A-SYNTHETIC',manufacturer:'Synthetic A',model:'A',serialNumber:'SERIAL-A',createdBy:ua,updatedBy:ua},
    {_id:ab,facilityId:b,departmentId:db,ctrlNumber:'B-SYNTHETIC',manufacturer:'Private B maker',model:'Private B model',serialNumber:'SERIAL-B',createdBy:ub,updatedBy:ub}]);
  await WorkOrder.create([{_id:wa,facilityId:a,assetId:aa,departmentId:da,description:'Synthetic A WO',workOrderNumber:1,assignedTo:ua},
    {_id:wb,facilityId:b,assetId:ab,departmentId:db,description:'PRIVATE-B-WO-DESCRIPTION',workOrderNumber:2,assignedTo:ub}]);
});
afterEach(async () => { for (const Model of models || []) await Model.deleteMany({}); jest.restoreAllMocks(); });
afterAll(async () => { axios.defaults.adapter = originalAdapter; if(harness) await harness.stop(); });

control('database target guard rejects configured and arbitrary loopback targets', async () => {
  await expect(mongoose.connect(process.env.MONGO_URI)).rejects.toThrow('Tests refused');
  await expect(mongoose.connect('mongodb://127.0.0.1:27017/real-looking')).rejects.toThrow('Tests refused');
});
control('contract adapter is inherited by real per-request client and forwards synthetic context', async () => {
  await createWO().expect(201); expect(calls).toEqual([{url:`/contracts/active-for-asset/${aa}`,selected:s(a),authorized:true}]);
});
control('contract adapter rejects unexpected requests without native network fallback', async () => {
  await expect(axios.get('http://unexpected.invalid')).rejects.toThrow('Unexpected synthetic');
});
for (const role of roles) for (const operation of ['asset create','asset update','WO create','WO update','WO assign','WO schedule','WO status','asset parent']) {
  control(`${role}: ${operation} role gate`, async () => {
    const accepted = ['admin','technician'].includes(role);
    const expected = accepted ? operation.endsWith('create') ? 201 : 200 : role === 'anonymous' ? 401 : 403;
    let res;
    if(operation==='asset create') res=await createAsset({},role);
    if(operation==='asset update') res=await send('put',`/assets/${aa}`,{description:'Changed'},role);
    if(operation==='WO create') res=await createWO({},role);
    if(operation==='WO update') res=await send('put',`/workorders/${wa}`,{description:'Changed'},role);
    if(operation==='WO assign') res=await send('patch',`/workorders/${wa}/assign`,{assignedTo:s(ua)},role);
    if(operation==='WO schedule') res=await send('patch',`/workorders/${wa}/schedule`,{scheduledDate:'2026-12-01'},role);
    if(operation==='WO status') res=await send('patch',`/workorders/${wa}/status`,{status:'Completed'},role);
    if(operation==='asset parent') res=await send('patch',`/assets/${aa}/parent`,{parentAsset:null},role);
    expect(res.status).toBe(expected);
    if(!accepted) {expect(await Asset.countDocuments()).toBe(2);expect(await WorkOrder.countDocuments()).toBe(2);}
  });
}
for (const [name,value,status] of [
  ['own',()=>s(a),201],['foreign',()=>s(b),201],['missing',()=>undefined,400],['malformed',()=> 'bad-id',400],['nonexistent',()=>s(missing),201],['null',()=>null,400],
]) observe(`Asset create Facility ${name}`, async()=>{
  const res=await createAsset({facilityId:value()}); expect(res.status).toBe(status);
  if(status===201) expect((await row(Asset,new mongoose.Types.ObjectId(res.body.asset._id))).facilityId.toString()).toBe(value());
  else expect(await Asset.countDocuments()).toBe(2);
});
for(const role of ['technician']) security(`Asset create cannot cross selected Facility (${role})`,async()=>{const r=await createAsset({facilityId:s(b)},role);denied(r);expect(await Asset.countDocuments({facilityId:b})).toBe(1);});
security('Asset create rejects nonexistent Facility',async()=>safe4xx(await createAsset({facilityId:s(missing)})));
for (const op of ['create','update']) for(const ref of ['departmentId','parentAsset']) {
  observe(`Asset ${op} accepts foreign ${ref}`,async()=>{
    const body={[ref]:s(ref==='departmentId'?db:ab)};
    const r=op==='create'?await createAsset(body):await send('put',`/assets/${aa}`,body);
    expect(r.status).toBe(op==='create'?201:200);
    const result=await row(Asset,op==='create'?new mongoose.Types.ObjectId(r.body.asset._id):aa);
    expect(s(result[ref])).toBe(body[ref]);
  });
  security(`Asset ${op} refuses foreign ${ref}`,async()=>{
    const body={[ref]:s(ref==='departmentId'?db:ab)};
    denied(op==='create'?await createAsset(body):await send('put',`/assets/${aa}`,body));
  });
}
for(const op of ['create','update']) for(const ref of ['departmentId','parentAsset','templateId']) for(const variant of ['same','missing','malformed']) {
 observe(`Asset ${op} ${ref} ${variant}`,async()=>{
   if(ref==='parentAsset' && variant==='same') await Asset.create(assetBody({_id:wa,ctrlNumber:'VALID-PARENT'}));
   const value=variant==='missing'?s(missing):variant==='malformed'?'bad-id':s(ref==='departmentId'?da:ref==='parentAsset'?wa:template._id);
   const res=op==='create'?await createAsset({[ref]:value}):await send('put',`/assets/${aa}`,{[ref]:value});
   const status=variant==='malformed'?(op==='create'?400:500):(op==='create'&&ref==='templateId'&&variant==='missing'?404:op==='create'?201:200);
   expect(res.status).toBe(status);
 });
}
control('Asset dedicated parent route refuses foreign reference',async()=>{await send('patch',`/assets/${aa}/parent`,{parentAsset:s(ab)}).expect(404);expect((await row(Asset,aa)).parentAsset).toBeNull();});
control('Asset dedicated parent route permits same-Facility parent',async()=>{const p=await Asset.create(assetBody({ctrlNumber:'PARENT'}));await send('patch',`/assets/${aa}/parent`,{parentAsset:s(p._id)}).expect(200);});
for(const target of ['own','foreign']) {
 observe(`Asset parent unlink ${target} exposes implementation error`,async()=>{const r=await send('delete',`/assets/${target==='own'?aa:ab}/parent`);expect(r.status).toBe(400);expect(r.body.error).toMatch(/iterable|iterator|Spread syntax|Symbol/);});
 security(`Asset parent unlink ${target} safe error`,async()=>safe4xx(await send('delete',`/assets/${target==='own'?aa:ab}/parent`)));
}
for(const field of ['createdBy','updatedBy','deletedBy','deletedAt','metrics.totalMaintenanceCost','contractId','assignedTo','workOrders','duplicateOf']) {
 const value=()=>field.endsWith('At')?oldDate:field==='metrics.totalMaintenanceCost'?99999:field==='workOrders'?[s(wb)]:s(ub);
 observe(`Asset create ignores non-allowlisted ${field}`,async()=>{const r=await createAsset({[field]:value()});expect(r.status).toBe(201);const doc=await row(Asset,new mongoose.Types.ObjectId(r.body.asset._id));expect(JSON.stringify(doc[field])).not.toBe(JSON.stringify(value()));});
}
security('Asset create stamps canonical actor',async()=>{const r=await createAsset().expect(201);expect(r.body.asset.createdBy).toBe(s(ua));expect(r.body.asset.updatedBy).toBe(s(ua));});
observe('Asset create actor fields are null despite valid canonical JWT',async()=>{const r=await createAsset().expect(201);expect(r.body.asset.createdBy).toBeNull();expect(r.body.asset.updatedBy).toBeNull();});
const assetUpdates = [
 ['facilityId',()=>({facilityId:s(b)}),d=>s(d.facilityId),()=>s(b)],
 ['$set facilityId',()=>({$set:{facilityId:s(b)}}),d=>s(d.facilityId),()=>s(b)],
 ['createdBy',()=>({createdBy:s(ub)}),d=>s(d.createdBy),()=>s(ub)],
 ['updatedBy',()=>({updatedBy:s(ub)}),d=>s(d.updatedBy),()=>s(ub)],
 ['deletedBy',()=>({deletedBy:s(ub)}),d=>s(d.deletedBy),()=>s(ub)],
 ['deletedAt',()=>({deletedAt:oldDate}),d=>d.deletedAt.toISOString(),()=>oldDate],
 ['metrics',()=>({metrics:{totalMaintenanceCost:99999}}),d=>d.metrics.totalMaintenanceCost,()=>99999],
 ['dotted metrics',()=>({'metrics.totalMaintenanceCost':99999}),d=>d.metrics.totalMaintenanceCost,()=>99999],
 ['foreign workOrders',()=>({workOrders:[s(wb)]}),d=>s(d.workOrders[0]),()=>s(wb)],
];
for(const [label,payload,read,want] of assetUpdates) {
 observe(`Asset PUT persists ${label}`,async()=>{await send('put',`/assets/${aa}`,payload()).expect(200);expect(read(await row(Asset,aa))).toBe(want());});
 security(`Asset PUT protects ${label}`,async()=>{const before=await row(Asset,aa);await send('put',`/assets/${aa}`,payload());const after=await row(Asset,aa);expect(read(after)).not.toBe(want());expect(after._id).toEqual(before._id);});
}
security('Asset detail must not disclose foreign WO after client reference injection',async()=>{await send('put',`/assets/${aa}`,{workOrders:[s(wb)]});const r=await send('get',`/assets/${aa}`);expect(JSON.stringify(r.body)).not.toContain('PRIVATE-B-WO-DESCRIPTION');});
observe('Asset detail populates injected foreign WO description',async()=>{await send('put',`/assets/${aa}`,{workOrders:[s(wb)]}).expect(200);const r=await send('get',`/assets/${aa}`).expect(200);expect(JSON.stringify(r.body)).toContain('PRIVATE-B-WO-DESCRIPTION');});
control('Asset foreign target PUT denied despite replacement body Facility A',async()=>{const before=await snap(Asset,ab);await send('put',`/assets/${ab}`,{facilityId:s(a)}).expect(404);expect(await snap(Asset,ab)).toBe(before);});
control('foreign serial duplicate does not disclose duplicateOf',async()=>{const r=await createAsset({serialNumber:'SERIAL-B'}).expect(201);expect(r.body.duplicateOf).toBeUndefined();expect(JSON.stringify(r.body)).not.toContain(s(ab));});
control('visible serial duplicate advisory retained',async()=>{const r=await createAsset({serialNumber:'SERIAL-A'}).expect(201);expect(r.body.duplicateOf).toBe(s(aa));});
observe('global ctrlNumber uniqueness discloses conflict but not foreign ID',async()=>{const r=await createAsset({ctrlNumber:'B-SYNTHETIC'}).expect(409);expect(JSON.stringify(r.body)).not.toContain(s(ab));});
control('Asset update duplicate-like serial emits no foreign duplicate identifier',async()=>{const r=await send('put',`/assets/${aa}`,{serialNumber:'SERIAL-B'}).expect(200);expect(JSON.stringify(r.body)).not.toContain(s(ab));});
for(const bodyFacility of ['own','foreign','missing','malformed','nonexistent','null']) observe(`WO create ignores body Facility ${bodyFacility} and derives Asset A`,async()=>{
 const values={own:s(a),foreign:s(b),missing:undefined,malformed:'bad-id',nonexistent:s(missing),null:null};const r=await createWO({facilityId:values[bodyFacility]}).expect(201);expect(r.body.facilityId).toBe(s(a));
});
for(const role of ['technician','admin']) {
 observe(`WO create foreign Asset derives foreign Facility (${role})`,async()=>{const r=await createWO({assetId:s(ab),facilityId:s(a)},role).expect(201);expect(r.body.facilityId).toBe(s(b));});
 if(role==='technician') security(`WO create requires Asset in selected Facility (${role})`,async()=>{denied(await createWO({assetId:s(ab)},role));expect(await WorkOrder.countDocuments({facilityId:b})).toBe(1);});
}
for(const variant of ['missing','malformed','nonexistent']) control(`WO create ${variant} Asset safely rejected`,async()=>{const values={missing:undefined,malformed:'bad-id',nonexistent:s(missing)};const r=await createWO({assetId:values[variant]});safe4xx(r);expect(await WorkOrder.countDocuments()).toBe(2);});
control('WO create cannot use legacy Asset without Facility',async()=>{await Asset.collection.insertOne({_id:missing,ctrlNumber:'GLOBAL-SYNTHETIC',manufacturer:'Synthetic',model:'Global'});await createWO({assetId:s(missing)}).expect(400);});
for(const ref of ['departmentId','ticketId']) {
 observe(`WO create accepts foreign ${ref}`,async()=>{if(ref==='ticketId') await Ticket.create({_id:missing,facilityId:b,assetId:ab,subject:'Private synthetic B ticket',type:'service',requestedBy:ub});const value=s(ref==='departmentId'?db:missing);const r=await createWO({[ref]:value}).expect(201);expect(r.body[ref]).toBe(value);});
 security(`WO create rejects foreign ${ref}`,async()=>{if(ref==='ticketId') await Ticket.create({_id:missing,facilityId:b,assetId:ab,subject:'Private synthetic B ticket',type:'service',requestedBy:ub});denied(await createWO({[ref]:s(ref==='departmentId'?db:missing)}));});
}
for(const field of ['departmentId','assignedTo','ticketId']) for(const type of ['malformed','nonexistent']) observe(`WO create ${field} ${type}`,async()=>{const r=await createWO({[field]:type==='malformed'?'bad-id':s(missing)});expect(r.status).toBe(type==='malformed'?500:201);});
for(const role of ['technician','customer','viewer','tech','missing','unknown','foreign technician']) for(const op of ['create','assign']) observe(`POLICY: WO ${op} assignee ${role}`,async()=>{const id=role==='foreign technician'?ub:users[role];const r=op==='create'?await createWO({assignedTo:s(id)}):await send('patch',`/workorders/${wa}/assign`,{assignedTo:s(id)});expect(r.status).toBe(op==='create'?201:200);expect(s((await row(WorkOrder,op==='create'?new mongoose.Types.ObjectId(r.body._id):wa)).assignedTo)).toBe(s(id));});
observe('POLICY: assignment response populates B-only username',async()=>{const r=await send('patch',`/workorders/${wa}/assign`,{assignedTo:s(ub)}).expect(200);expect(JSON.stringify(r.body)).toContain('Private B technician');});
for(const field of ['createdBy','updatedBy']) control(`WO create ${field} is server stamped`,async()=>{const r=await createWO({[field]:s(ub)}).expect(201);expect(r.body[field]).toBe(s(ua));});
const woSpoofs = [
 ['createdAt',()=>({createdAt:oldDate}),d=>d.createdAt,()=>oldDate],
 ['updatedAt',()=>({updatedAt:oldDate}),d=>d.updatedAt,()=>oldDate],
 ['deletedAt',()=>({deletedAt:oldDate}),d=>d.deletedAt,()=>oldDate],
 ['deletedBy',()=>({deletedBy:s(ub)}),d=>d.deletedBy,()=>s(ub)],
 ['workOrderNumber',()=>({workOrderNumber:99999}),d=>d.workOrderNumber,()=>99999],
 ['labor actor',()=>({timeLogs:[{userId:s(ub),timeSpent:10,createdAt:oldDate}]}),d=>d.timeLogs[0]?.userId,()=>s(ub)],
 ['travel actor',()=>({travelLogs:[{userId:s(ub),travelTime:10,createdAt:oldDate}]}),d=>d.travelLogs[0]?.userId,()=>s(ub)],
 ['foreign equipment',()=>({testEquipmentUsed:[{equipmentId:s(ab),usedBy:s(ub),usedAt:oldDate}]}),d=>d.testEquipmentUsed[0]?.equipmentId,()=>s(ab)],
 ['parts actor',()=>({partsUsed:[{partId:s(missing),quantity:1,usedBy:s(ub)}]}),d=>d.partsUsed[0]?.usedBy,()=>s(ub)],
 ['procedure result actor',()=>({procedures:[{_id:s(missing),name:'Synthetic injected',taskResults:[{taskId:s(missing),type:'comment',submittedBy:s(ub),submittedAt:oldDate}]}]}),d=>d.procedures[0]?.taskResults[0]?.submittedBy,()=>s(ub)],
];
for(const [name,body,read,value] of woSpoofs) {
 observe(`WO create ${name} persistence observation`,async()=>{const r=await createWO(body()).expect(201);if(name==='updatedAt') expect(read(r.body)).not.toBe(value()); else expect(read(r.body)).toBe(value());});
 security(`WO create protects ${name}`,async()=>{const r=await createWO(body());if(r.status===201)expect(read(r.body)).not.toBe(value());else safe4xx(r);});
}
for(const name of ['createdFrom','requestedBy','vendorService','costs','contractId']) observe(`WO create ${name} policy/derivation`,async()=>{
 const values={createdFrom:'automation',requestedBy:s(ub),vendorService:{vendorId:s(missing),vendorName:'Synthetic unvalidated vendor'},costs:{total:99999},contractId:s(missing)};
 const r=await createWO({[name]:values[name]}).expect(201);
 if(name==='costs') expect(r.body.costs.total).toBe(0);
 else if(name==='contractId') expect(r.body.contractId).toBeNull();
 else if(name==='vendorService') expect(r.body.vendorService.vendorId).toBe(s(missing));
 else expect(r.body[name]).toBe(values[name]);
});
for(const reply of ['valid','invalid','unavailable']) control(`WO contract adapter ${reply} behavior`,async()=>{contractReply=reply==='valid'?s(missing):reply==='invalid'?'invalid-id':'unavailable';const r=await createWO({contractId:s(ub)}).expect(201);expect(r.body.contractId).toBe(reply==='valid'?s(missing):null);});
for(const type of ['foreign','malformed','missing']) for(const op of ['assign','schedule','status','put']) control(`WO ${op} ${type} parent denied`,async()=>{const target=type==='foreign'?s(wb):type==='malformed'?'bad-id':s(missing);const body={assign:{assignedTo:s(ua)},schedule:{scheduledDate:'2026-12-01'},status:{status:'Completed'},put:{description:'Changed'}};const r=await send(op==='put'?'put':'patch',`/workorders/${target}${op==='put'?'':'/'+op}`,body[op]);safe4xx(r);});
for(const field of ['facilityId','assetId','departmentId','contractId','ticketId','timeLogs','travelLogs','partsUsed','testEquipmentUsed','procedures','createdBy','updatedBy','costs','$set','timeLogs.0.userId']) control(`#5 WO PUT protects ${field}`,async()=>{const before=await snap(WorkOrder,wa);await send('put',`/workorders/${wa}`,{[field]:field==='$set'?{facilityId:s(b)}:s(b)}).expect(400);expect(await snap(WorkOrder,wa)).toBe(before);});
for(const op of ['assign','schedule','status']) control(`WO ${op} ignores ownership rebinding payload`,async()=>{const before=await row(WorkOrder,wa);await send('patch',`/workorders/${wa}/${op}`,{assignedTo:s(ua),scheduledDate:'2026-12-01',status:'Completed',facilityId:s(b),assetId:s(ab),departmentId:s(db),contractId:s(missing),ticketId:s(missing),createdBy:s(ub)}).expect(200);const after=await row(WorkOrder,wa);for(const f of ['facilityId','assetId','departmentId','contractId','ticketId','createdBy'])expect(after[f]).toEqual(before[f]);expect(s(after.updatedBy)).toBe(s(ua));});
for(const kind of ['asset','WO']) for(const selected of ['absent','foreign','malformed']) observe(`${kind} create selected context ${selected}`,async()=>{
 const sel=selected==='absent'?null:selected==='foreign'?b:'bad-id';const r=kind==='asset'?await createAsset({},'technician',sel):await createWO({},'technician',sel);
 expect(r.status).toBe(kind==='asset'&&selected!=='absent'?500:201);
});
security('WO create rejects unauthorized selected Facility even with own Asset',async()=>denied(await createWO({},'technician',b)));
for(const kind of ['asset','WO']) security(`${kind} create conflicting context fails safely`,async()=>safe4xx(kind==='asset'?await createAsset({},'technician',b):await createWO({},'technician',b)));
for(const [label,method,path,body] of [
 ['Asset invalid department update','put',()=>`/assets/${aa}`,()=>({departmentId:'bad-id'})],
 ['Asset numeric ctrlNumber','post',()=>'/assets',()=>assetBody({ctrlNumber:123})],
 ['WO invalid assignee create','post',()=>'/workorders',()=>woBody({assignedTo:'bad-id'})],
 ['WO invalid department create','post',()=>'/workorders',()=>woBody({departmentId:'bad-id'})],
]) security(`${label} is safe 4xx`,async()=>safe4xx(await send(method,path(),body())));
control('ticket promotion with schema-valid _id cannot find absent ticketId schema field',async()=>{await Ticket.create({_id:missing,facilityId:a,assetId:aa,subject:'Synthetic ticket',status:'Open',type:'service',requestedBy:ua});await send('post',`/workorders/from-ticket/${missing}`,{}).expect(404);});

for(const role of ['technician','admin']) control(`${role} B context authorized own creates`,async()=>{
 const claims={sub:s(ub),facilityId:s(b),facilities:[s(b)]};
 const ar=await createAsset({facilityId:s(b)},role,b,claims).expect(201);expect(ar.body.asset.facilityId).toBe(s(b));
 const wr=await createWO({assetId:s(ab)},role,b,claims).expect(201);expect(wr.body.facilityId).toBe(s(b));
});
observe('POLICY: admin with selected A can explicitly create Asset B',async()=>{const r=await createAsset({facilityId:s(b)},'admin').expect(201);expect(r.body.asset.facilityId).toBe(s(b));});
control('admin without selected Facility retains global Asset access',async()=>{await send('put',`/assets/${ab}`,{description:'Admin edit'},'admin',null).expect(200);});
for(const change of ['unset','null']) control(`Asset required Facility cannot be removed using ${change}`,async()=>{
 const before=await row(Asset,aa);const r=await send('put',`/assets/${aa}`,change==='unset'?{$unset:{facilityId:1}}:{facilityId:null});expect(r.status).toBe(500);expect((await row(Asset,aa)).facilityId).toEqual(before.facilityId);
});
observe('Asset PUT accepts nonexistent Facility reference',async()=>{await send('put',`/assets/${aa}`,{facilityId:s(missing)}).expect(200);expect(s((await row(Asset,aa)).facilityId)).toBe(s(missing));});
security('Asset PUT requires destination Facility existence',async()=>safe4xx(await send('put',`/assets/${aa}`,{facilityId:s(missing)})));
for(const field of ['createdAt','updatedAt']) control(`Asset PUT does not permit ${field} timestamp spoofing`,async()=>{await send('put',`/assets/${aa}`,{[field]:oldDate}).expect(200);expect((await row(Asset,aa))[field].toISOString()).not.toBe(oldDate);});
for(const field of ['assignedTo','contractId','duplicateOf']) observe(`POLICY: Asset PUT accepts unvalidated ${field}`,async()=>{await send('put',`/assets/${aa}`,{[field]:s(missing)}).expect(200);expect(s((await row(Asset,aa))[field])).toBe(s(missing));});
observe('Asset PUT bypasses save-hook self-parent guard',async()=>{await send('put',`/assets/${aa}`,{parentAsset:s(aa)}).expect(200);expect(s((await row(Asset,aa)).parentAsset)).toBe(s(aa));});
for(const op of ['create','update']) observe(`POLICY: Asset ${op} accepts nonexistent maintenance Procedure`,async()=>{
 const body={maintenanceSchedule:{procedure:s(missing),lastMaintenance:oldDate}};const r=op==='create'?await createAsset(body):await send('put',`/assets/${aa}`,body);expect(r.status).toBe(op==='create'?201:200);
});
for(const ref of ['departmentId','templateId','parentAsset']) security(`Asset update rejects missing ${ref} reference`,async()=>safe4xx(await send('put',`/assets/${aa}`,{[ref]:s(missing)})));
for(const variant of ['missing','malformed']) observe(`WO assignment ${variant} user`,async()=>{const r=await send('patch',`/workorders/${wa}/assign`,{assignedTo:variant==='missing'?s(missing):'bad-id'});expect(r.status).toBe(variant==='missing'?200:400);});
for(const field of ['departmentId','assignedTo','ticketId']) security(`WO create rejects nonexistent ${field}`,async()=>safe4xx(await createWO({[field]:s(missing)})));
security('WO assignment requires referenced user existence',async()=>safe4xx(await send('patch',`/workorders/${wa}/assign`,{assignedTo:s(missing)})));
for(const value of ['Archived','Unrecognized state']) observe(`WO status dedicated route accepts ${value} without archive audit`,async()=>{await send('patch',`/workorders/${wa}/status`,{status:value}).expect(200);const d=await row(WorkOrder,wa);expect(d.status).toBe(value);expect(d.deletedAt).toBeNull();expect(d.deletedBy).toBeNull();});
security('technician cannot bypass admin archive through status endpoint',async()=>{await send('patch',`/workorders/${wa}/status`,{status:'Archived'});expect((await row(WorkOrder,wa)).status).not.toBe('Archived');});
security('technician cannot bypass admin archive through WO create',async()=>{const r=await createWO({status:'archived'});if(r.status===201)expect(r.body.status).not.toBe('Archived');else safe4xx(r);});
control('legitimate WO status/completion ordinary edit remains functional',async()=>{await send('put',`/workorders/${wa}`,{status:'Completed',completionDate:'2026-09-15'}).expect(200);expect((await row(WorkOrder,wa)).status).toBe('Completed');});
for(const kind of ['asset','WO']) observe(`${kind} creation with token missing default Facility`,async()=>{const r=kind==='asset'?await createAsset({},'technician',a,{facilityId:undefined}):await createWO({},'technician',a,{facilityId:undefined});expect(r.status).toBe(201);});
control('Asset create timestamps and supplied duplicate metadata are ignored',async()=>{const r=await createAsset({createdAt:oldDate,updatedAt:oldDate,duplicateOf:s(ab)}).expect(201);expect(r.body.asset.createdAt).not.toBe(oldDate);expect(r.body.asset.updatedAt).not.toBe(oldDate);expect(r.body.asset.duplicateOf).toBeNull();});

observe('Asset move makes A record readable in B and inaccessible in A',async()=>{
 await send('put',`/assets/${aa}`,{facilityId:s(b)}).expect(200);
 await send('get',`/assets/${aa}`).expect(404);
 await send('get',`/assets/${aa}`,undefined,'technician',b,{sub:s(ub),facilityId:s(b),facilities:[s(b)]}).expect(200);
});
observe('WO create accepts Archived status without archive provenance',async()=>{const r=await createWO({status:'archived'}).expect(201);expect(r.body.status).toBe('Archived');expect(r.body.deletedAt).toBeNull();expect(r.body.deletedBy).toBeNull();});
control('dedicated archive endpoints remain admin-only for technicians',async()=>{await send('patch',`/assets/${aa}/archive`,{}).expect(403);await send('patch',`/workorders/${wa}/archive`,{}).expect(403);});
for(const kind of ['asset','WO']) control(`${kind} rejects arbitrary update operator keys on creation`,async()=>{
 const payload={$set:{facilityId:s(b),createdBy:s(ub)}};
 const r=kind==='asset'?await createAsset(payload):await createWO(payload);expect(r.status).toBe(201);expect(kind==='asset'?r.body.asset.facilityId:r.body.facilityId).toBe(s(a));
});
for(const f of ['description','priority','status','scheduledDate','dueDate','completionDate']) observe(`WO create legitimate ${f} remains client supplied`,async()=>{
 const values={description:'Synthetic ordinary description',priority:'high',status:'completed',scheduledDate:'2026-10-01',dueDate:'2026-10-02',completionDate:'2026-10-03'};
 const r=await createWO({[f]:values[f]}).expect(201);expect(r.body[f]).toBe(f==='priority'?'High':f==='status'?'Completed':f.endsWith('Date')?values[f]+'T00:00:00.000Z':values[f]);
});
control('valid shared Template is usable from both Facilities without invented ownership',async()=>{
 await createAsset({templateId:s(template._id)}).expect(201);
 await createAsset({ctrlNumber:'SHARED-TEMPLATE-B',templateId:s(template._id),facilityId:s(b)},'technician',b,{sub:s(ub),facilityId:s(b),facilities:[s(b)]}).expect(201);
});

observe('Asset create malformed maintenance Procedure returns schema cast details',async()=>{const r=await createAsset({maintenanceSchedule:{procedure:'bad-id'}}).expect(400);expect(JSON.stringify(r.body)).toMatch(/Cast to ObjectId/);});
security('Asset create malformed maintenance Procedure must not expose cast internals',async()=>safe4xx(await createAsset({maintenanceSchedule:{procedure:'bad-id'}})));
