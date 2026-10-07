import { createRequire } from 'node:module';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import axios from 'axios';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../security/_tests_/securityTestHarness.js';
import Contract from '../../models/Contract.js';
import { applyApprovedAmendmentToContract } from '../../services/amendmentLifecycleService.js';
const require = createRequire(new URL('../../../../core-service/package.json', import.meta.url)),
  cm = require('mongoose'),
  express = require('express');
const secret = 'synthetic-21-coverage-secret';
let h, app, core, A, F, W, T, facility, foreign, actor, a, b, x, v, c, forwarded;
const id = () => new mongoose.Types.ObjectId();
const headers = (role = 'admin', selected = facility) => ({
  Authorization: `Bearer ${jwt.sign({
    sub: String(actor),
    role,
    facilityId: String(facility),
    facilities: [String(facility)]
  }, secret, {
    issuer: 'cronus.api',
    audience: 'cronus.app',
    expiresIn: '10m'
  })}`,
  'x-facility-id': String(selected)
});
const create = (ids = [String(a)], vendor = v, coverageType = 'full') => request(app).post(`/contracts/${c.id}/vendor-links`).set(headers()).send({
  vendorId: String(vendor),
  coveredAssetIds: ids,
  coverageType
});
const update = (link, body) => request(app).post(`/contracts/${c.id}/vendor-links/${link}/assets`).set(headers()).send(body);
const saved = () => Contract.findById(c.id).lean();
async function seed(extra = {}) {
  return Contract.create({
    name: 'Synthetic #21',
    contractNumber: String(id()),
    facilityId: facility,
    type: 'customer',
    status: 'active',
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    totalValue: 1000,
    coveredAssets: [a],
    ...extra
  });
}
jest.setTimeout(120000);
beforeAll(async () => {
  process.env.NODE_ENV = 'security-test';
  process.env.CRON_ENABLED = 'false';
  process.env.JWT_SECRET = secret;
  process.env.JWT_ISS = 'cronus.api';
  process.env.JWT_AUD = 'cronus.app';
  h = await createIsolatedMongoHarness({
    coreMongoose: cm,
    contractMongoose: mongoose
  });
  A = require('./src/models/Asset');
  F = require('./src/models/Facility');
  W = require('./src/models/WorkOrder');
  T = require('./src/models/EquipmentTemplate');
  core = express();
  core.use(express.json());
  core.use('/assets', require('./src/routers/assetsRouter'));
  app = (await import('../../../app.js')).createApp();
});
beforeEach(async () => {
  for (const level of ['log', 'warn', 'error']) jest.spyOn(console, level).mockImplementation(() => {});
  facility = id();
  foreign = id();
  actor = id();
  a = id();
  b = id();
  x = id();
  v = id();
  forwarded = [];
  await F.collection.insertMany([{
    _id: new cm.Types.ObjectId(String(facility)),
    name: 'Synthetic selected'
  }, {
    _id: new cm.Types.ObjectId(String(foreign)),
    name: 'Synthetic foreign'
  }]);
  await A.collection.insertMany([{
    _id: new cm.Types.ObjectId(String(a)),
    facilityId: new cm.Types.ObjectId(String(facility)),
    ctrlNumber: 'A',
    manufacturer: 'Synthetic',
    model: 'Pump',
    workOrders: []
  }, {
    _id: new cm.Types.ObjectId(String(b)),
    facilityId: new cm.Types.ObjectId(String(facility)),
    ctrlNumber: 'B',
    workOrders: []
  }, {
    _id: new cm.Types.ObjectId(String(x)),
    facilityId: new cm.Types.ObjectId(String(foreign)),
    ctrlNumber: 'X',
    workOrders: []
  }]);
  c = await seed();
  jest.spyOn(axios, 'create').mockImplementation(config => ({
    defaults:{baseURL:'synthetic-core-only'},
    async get(path, options) {
      forwarded.push({
        path,
        headers: config.headers,
        options
      });
      if (path.startsWith('/vendors/')) return {
        data: {
          _id: path.split('/')[2],
          name: 'Synthetic Vendor'
        }
      };
      if (path.startsWith('/assets/')) {
        const r = await request(core).get(path).set(config.headers);
        if (r.status !== 200) throw {
          response: {
            status: r.status
          }
        };
        return {
          data: r.body
        };
      }
      if (path.startsWith('/workorders/by-contract/')) return {
        data: {
          workOrders: []
        }
      };
      if (path === '/workorders') return {
        data: {
          items: []
        }
      };
      throw new Error('Unapproved synthetic core target ' + path);
    },
    async post(path, body, options = {}) {
      if (!['/assets/batch','/assets/lifecycle/batch'].includes(path)) throw new Error('Unapproved target');
      const r = await request(core).post(path).set({...config.headers,...options.headers}).send(body);
      if (r.status !== 200) throw {
        response: {
          status: r.status
        }
      };
      return {
        data: r.body
      };
    }
  }));
});
afterEach(async () => {
  await Promise.all([Contract.deleteMany({}), A.deleteMany({}), F.deleteMany({}), W.deleteMany({}), T.deleteMany({})]);
  jest.restoreAllMocks();
});
afterAll(async () => {
  if (h) await h.stop();
});
test('A / vendor A valid and headers are request-specific', async () => {
  const r = await create().expect(201);
  expect(r.body.data.coveredAssetIds).toEqual([String(a)]);
  const call = forwarded.find(row => row.path === `/assets/${a}`);
  expect(call.headers).toMatchObject(headers());
  expect(r.body.coverage.isConsistent).toBe(true);
});
test('A,B / vendor B valid', async () => {
  c = await seed({
    coveredAssets: [a, b]
  });
  await create([String(b)]).expect(201);
});
test('A / vendor B rejected without membership expansion', async () => {
  await create([String(b)]).expect(409);
  expect((await saved()).vendorLinks).toHaveLength(0);
  expect((await saved()).coveredAssets.map(String)).toEqual([String(a)]);
});
test('missing current member Asset rejected', async () => {
  const missing = id();
  c = await seed({
    coveredAssets: [missing]
  });
  await create([String(missing)]).expect(400);
  expect((await saved()).vendorLinks).toHaveLength(0);
});
test('cross-Facility member reference rejected by actual core authorization', async () => {
  c = await seed({
    coveredAssets: [x]
  });
  await create([String(x)]).expect(400);
  expect((await saved()).vendorLinks).toHaveLength(0);
});
test('archived member Asset rejected', async () => {
  await A.collection.updateOne({
    _id: new cm.Types.ObjectId(String(a))
  }, {
    $set: {
      isArchived: true
    }
  });
  await create().expect(400);
});
test('deleted member Asset rejected', async () => {
  await A.collection.updateOne({
    _id: new cm.Types.ObjectId(String(a))
  }, {
    $set: {
      deletedAt: new Date()
    }
  });
  await create().expect(400);
});
for (const ids of [['bad'], [null], 'not-array', [123]]) test(`invalid create ${JSON.stringify(ids)} rejected`, async () => {
  await create(ids).expect(400);
  expect((await saved()).vendorLinks).toHaveLength(0);
});
test('duplicate create IDs stored once', async () => expect((await create([String(a), String(a)]).expect(201)).body.data.coveredAssetIds).toEqual([String(a)]));
test('all Contract members can be assigned', async () => {
  c = await seed({
    coveredAssets: [a, b]
  });
  expect((await create([String(a), String(b)]).expect(201)).body.data.coveredAssetIds).toHaveLength(2);
});
test('complementary overlap preserved', async () => {
  await create([String(a)], v, 'parts-only').expect(201);
  const r = await create([String(a)], id(), 'labor-only').expect(201);
  expect(r.body.coverage.overlaps[0].status).toBe('complementary');
});
test('full/full overlap explicitly surfaced; no unsupported exclusivity', async () => {
  await create().expect(201);
  const r = await create([String(a)], id()).expect(201);
  expect(r.body.coverage).toMatchObject({
    exclusivityPolicy: 'not_configured',
    overlaps: [{
      status: 'requires_review'
    }]
  });
});
test('invalid coverage type rejected', async () => await create([String(a)], v, 'unsupported').expect(400));
test('duplicate Vendor link still conflicts', async () => {
  await create().expect(201);
  await create().expect(409);
});
test('update adds valid member and records prospective history', async () => {
  c = await seed({
    coveredAssets: [a, b]
  });
  const r = await create().expect(201);
  await update(r.body.data._id, {
    add: [String(b)]
  }).expect(200);
  const link = (await saved()).vendorLinks[0];
  expect(link.coveredAssetIds.map(String)).toEqual([String(a), String(b)]);
  expect(link.responsibilityHistory[0]).toMatchObject({
    changedBy: actor,
    beforeAssetIds: [a],
    afterAssetIds: [a, b]
  });
});
test('valid removal preserves history, nonmember removal idempotent', async () => {
  const r = await create().expect(201);
  await update(r.body.data._id, {
    remove: [String(a), String(b)]
  }).expect(200);
  const link = (await saved()).vendorLinks[0];
  expect(link.coveredAssetIds).toHaveLength(0);
  expect(link.responsibilityHistory[0].beforeAssetIds.map(String)).toEqual([String(a)]);
});
test('duplicate add is safe and does not append fake history', async () => {
  const r = await create().expect(201);
  await update(r.body.data._id, {
    add: [String(a), String(a)]
  }).expect(200);
  expect((await saved()).vendorLinks[0].responsibilityHistory).toHaveLength(0);
});
test('rejected batch has no partial addition/removal/history', async () => {
  c = await seed({
    coveredAssets: [a, b]
  });
  const r = await create().expect(201);
  const before = JSON.stringify(await saved());
  await update(r.body.data._id, {
    add: [String(b), String(x)],
    remove: [String(a)]
  }).expect(409);
  expect(JSON.stringify(await saved())).toBe(before);
});
for (const body of [{add:null},{remove:null},{
  add: ['bad']
}, {
  remove: ['bad']
}, {
  add: 'bad'
}, {
  remove: {}
}]) test(`invalid update ${JSON.stringify(body)} rejects`, async () => {
  const r = await create().expect(201);
  await update(r.body.data._id, body).expect(400);
});
test('ambiguous add/remove same ID rejected', async () => {
  const r = await create().expect(201);
  await update(r.body.data._id, {
    add: [String(a)],
    remove: [String(a)]
  }).expect(400);
});
test('missing link returns 404', async () => await update(id(), {
  add: [String(a)]
}).expect(404));
test('legacy anomaly retained on read, lifecycle includes only Contract A', async () => {
  await Contract.collection.updateOne({
    _id: c._id
  }, {
    $set: {
      vendorLinks: [{
        _id: id(),
        vendorId: v,
        coveredAssetIds: [a, b],
        coverageType: 'full'
      }]
    }
  });
  const before = JSON.stringify(await saved());
  const r = await request(app).get(`/contracts/${c.id}/lifecycle-intelligence`).set(headers()).expect(200);
  expect(r.body.summary).toMatchObject({
    coveredAssetCount: 1,
    hydratedAssetCount: 1,
    replacementRecommendedCount: 0
  });
  expect(r.body.coverage.vendorResponsibility.anomalies[0].outOfCoverageAssetIds).toEqual([String(b)]);
  expect(r.body.population).toMatchObject({populationAssetCount:1,assessedAssetCount:1});
  expect(r.body.members.map(row=>row.assetId)).toEqual([String(a)]);
  expect(JSON.stringify(await saved())).toBe(before);
});
test('legacy anomaly blocks adding until explicit removal; removal audited', async () => {
  const link = id();
  await Contract.collection.updateOne({
    _id: c._id
  }, {
    $set: {
      vendorLinks: [{
        _id: link,
        vendorId: v,
        coveredAssetIds: [a, b],
        coverageType: 'full'
      }]
    }
  });
  await update(link, {
    add: [String(a)]
  }).expect(409);
  await update(link, {
    remove: [String(b)]
  }).expect(200);
  const savedLink = (await saved()).vendorLinks[0];
  expect(savedLink.coveredAssetIds.map(String)).toEqual([String(a)]);
  expect(savedLink.responsibilityHistory[0].beforeAssetIds.map(String)).toEqual([String(a), String(b)]);
});
test('commercial patch cannot silently validate an anomalous link', async () => {
  const link = id();
  await Contract.collection.updateOne({
    _id: c._id
  }, {
    $set: {
      vendorLinks: [{
        _id: link,
        vendorId: v,
        coveredAssetIds: [b],
        coverageType: 'full'
      }]
    }
  });
  await request(app).patch(`/contracts/${c.id}/vendor-links/${link}`).set(headers()).send({
    notes: 'x'
  }).expect(409);
});
for (const [role, status] of [['technician', 403], ['customer', 403]]) test(`${role} cannot mutate`, async () => await request(app).post(`/contracts/${c.id}/vendor-links`).set(headers(role)).send({
  vendorId: String(v),
  coveredAssetIds: [String(a)]
}).expect(status));
test('unauthenticated mutation denied', async () => await request(app).post(`/contracts/${c.id}/vendor-links`).send({
  vendorId: String(v)
}).expect(401));
test('wrong selected Facility Contract inaccessible', async () => await request(app).post(`/contracts/${c.id}/vendor-links`).set(headers('admin', foreign)).send({
  vendorId: String(v),
  coveredAssetIds: [String(a)]
}).expect(404));
test('non-admin wrong Facility read denied', async () => await request(app).get(`/contracts/${c.id}/lifecycle-intelligence`).set(headers('technician', foreign)).expect(403));
test('active Asset lookup never finds a vendor-only member', async () => {
  await Contract.collection.updateOne({
    _id: c._id
  }, {
    $set: {
      vendorLinks: [{
        _id: id(),
        vendorId: v,
        coveredAssetIds: [b]
      }]
    }
  });
  const r = await request(app).get(`/contracts/active-for-asset/${b}`).set(headers()).expect(200);
  expect(r.body.contractId).toBeNull();
});
test('Asset coverage never finds a vendor-only member', async () => {
  await Contract.collection.updateOne({
    _id: c._id
  }, {
    $set: {
      vendorLinks: [{
        _id: id(),
        vendorId: v,
        coveredAssetIds: [b]
      }]
    }
  });
  const r = await request(app).get(`/contracts/asset/${b}/coverage`).set(headers()).expect(200);
  expect(r.body.isCovered).toBe(false);
});
async function amendment(changeType, asset) {
  c.amendments.push({
    amendmentNumber: 'synthetic.1',
    status: 'approved',
    date: '2026-01-01',
    changeType,
    items: [{
      assetId: asset,
      deltaValue: 0
    }],
    totalDelta: 0
  });
  await c.save();
}
test('applied add becomes current coverage; nonapplied does not', async () => {
  await amendment('add', b);
  expect((await saved()).coveredAssets.map(String)).toEqual([String(a)]);
  await request(app).post(`/contracts/${c.id}/amendments/0/apply`).set(headers()).send({}).expect(200);
  expect((await saved()).coveredAssets.map(String)).toEqual([String(a), String(b)]);
});
test('unassigned applied remove ceases current coverage', async () => {
  await amendment('remove', a);
  await request(app).post(`/contracts/${c.id}/amendments/0/apply`).set(headers()).send({}).expect(200);
  expect((await saved()).coveredAssets).toHaveLength(0);
});
test('assigned removal conflicts without changing coverage/amendment/responsibility', async () => {
  await amendment('remove', a);
  await create().expect(201);
  const before = JSON.stringify(await saved());
  const r = await request(app).post(`/contracts/${c.id}/amendments/0/apply`).set(headers()).send({}).expect(409);
  expect(r.body.code).toBe('vendor_responsibility_conflict');
  expect(JSON.stringify(await saved())).toBe(before);
});
test('explicit responsibility removal permits amendment; history retained', async () => {
  await amendment('remove', a);
  const r = await create().expect(201);
  await update(r.body.data._id, {
    remove: [String(a)]
  }).expect(200);
  await request(app).post(`/contracts/${c.id}/amendments/0/apply`).set(headers()).send({}).expect(200);
  const result = await saved();
  expect(result.coveredAssets).toHaveLength(0);
  expect(result.vendorLinks[0].responsibilityHistory[0].beforeAssetIds.map(String)).toEqual([String(a)]);
});
test('concurrent coverage/removal cannot overwrite a newer responsibility mutation', async () => {
  await amendment('remove', a);
  const stale = await Contract.findById(c.id);
  applyApprovedAmendmentToContract(stale, 0, actor);
  await create().expect(201);
  await expect(stale.save()).rejects.toMatchObject({
    name: 'VersionError'
  });
  expect((await saved()).coveredAssets.map(String)).toEqual([String(a)]);
});
test('concurrent responsibility save cannot overwrite removed coverage', async () => {
  await amendment('remove', a);
  const stale = await Contract.findById(c.id);
  const fresh = await Contract.findById(c.id);
  applyApprovedAmendmentToContract(fresh, 0, actor);
  await fresh.save();
  stale.vendorLinks.push({
    vendorId: v,
    coveredAssetIds: [a]
  });
  await expect(stale.save()).rejects.toMatchObject({
    name: 'VersionError'
  });
  expect((await saved()).vendorLinks).toHaveLength(0);
});
test('coverage receipts stay Facility-scoped even for inconsistent foreign references', async () => {
  await seed({
    facilityId: foreign,
    coveredAssets: [b],
    amendments: [{
      amendmentNumber: 'foreign.1',
      status: 'approved',
      date: '2026-01-01',
      changeType: 'add',
      items: [{
        assetId: b,
        deltaValue: 0
      }]
    }]
  });
  const r = await request(app).get(`/contracts/asset/${b}/coverage`).set(headers()).expect(200);
  expect(r.body.isCovered).toBe(false);
  expect(r.body.contractsTouchingAsset).toEqual([]);
  expect(r.body.amendmentHistory).toEqual([]);
});
test('overview exposes raw anomalies without hydrating vendor-only Assets', async () => {
  await Contract.collection.updateOne({
    _id: c._id
  }, {
    $set: {
      vendorLinks: [{
        _id: id(),
        vendorId: v,
        coveredAssetIds: [a, b]
      }]
    }
  });
  const r = await request(app).get(`/contracts/${c.id}/overview`).set(headers()).expect(200);
  expect(r.body.assets.map(asset => asset._id)).toEqual([String(a)]);
  expect(r.body.contract.vendorLinks[0]).toMatchObject({
    coveredAssetIds: [String(a), String(b)],
    coveredAssetsCount: 1,
    responsibility: {
      assetIds: [String(a)],
      outOfCoverageAssetIds: [String(b)]
    }
  });
});
test('vendor-specific overview uses valid overlay but retains anomaly references', async () => {
  const link = id();
  await Contract.collection.updateOne({
    _id: c._id
  }, {
    $set: {
      vendorLinks: [{
        _id: link,
        vendorId: v,
        coveredAssetIds: [a, b]
      }]
    }
  });
  const r = await request(app).get(`/contracts/${c.id}/vendor-links/${link}/overview`).set(headers()).expect(200);
  expect(r.body.data.assets.map(asset => asset._id)).toEqual([String(a)]);
  expect(r.body.data.vendorLink.responsibility.outOfCoverageAssetIds).toEqual([String(b)]);
  expect(forwarded.find(row => row.path === '/workorders').options.params.assetIds).toBe(String(a));
});
test('profitability vendor population cannot exceed Contract population', async () => {
  await Contract.collection.updateOne({
    _id: c._id
  }, {
    $set: {
      vendorLinks: [{
        _id: id(),
        vendorId: v,
        coveredAssetIds: [a, b]
      }]
    }
  });
  const r = await request(app).get(`/contracts/${c.id}/profitability`).set(headers()).expect(200);
  expect(r.body.data.assets).toEqual({
    totalCovered: 1,
    vendorCovered: 1,
    nonVendorCovered: 0
  });
  expect(r.body.data.byVendor[0].responsibility.outOfCoverageAssetIds).toEqual([String(b)]);
  expect(forwarded.filter(row => row.path === '/workorders').every(row => row.options.params.assetIds === String(a))).toBe(true);
});
for (const status of ['draft', 'submitted', 'approved']) test(`${status} amendment does not change current membership`, async () => {
  c = await seed({
    amendments: [{
      amendmentNumber: 'test.1',
      status,
      date: '2026-01-01',
      changeType: 'add',
      items: [{
        assetId: b,
        deltaValue: 0
      }]
    }]
  });
  await create([String(b)]).expect(409);
  expect((await saved()).coveredAssets.map(String)).toEqual([String(a)]);
});
test('upstream extraneous or duplicate rows fail closed instead of influencing lifecycle', async () => {
  axios.create.mockImplementation(()=>({post:async()=>({data:{schemaVersion:'lifecycle-aggregate-v1',rows:[{assetId:String(a)},{assetId:String(b)},{assetId:String(a)}]}})}));
  const r=await request(app).get(`/contracts/${c.id}/lifecycle-intelligence`).set(headers()).expect(503);
  expect(r.body.population).toMatchObject({populationAssetCount:1,assessedAssetCount:0,unavailableAssessmentCount:1});
});
test('legacy versionless Contract concurrency cannot break containment', async () => {
  await amendment('remove', a);
  await Contract.collection.updateOne({
    _id: c._id
  }, {
    $unset: {
      __v: ''
    }
  });
  const stale = await Contract.findById(c.id);
  applyApprovedAmendmentToContract(stale, 0, actor);
  await create().expect(201);
  await expect(stale.save()).rejects.toThrow();
  expect((await saved()).coveredAssets.map(String)).toEqual([String(a)]);
});

test('legacy version guard clears after successful save on reused document',async()=>{await Contract.collection.updateOne({_id:c._id},{$unset:{__v:''}});const doc=await Contract.findById(c.id);doc.vendorLinks.push({vendorId:v,coveredAssetIds:[a]});await doc.save();doc.notes='Synthetic later edit';await expect(doc.save()).resolves.toBe(doc);expect((await saved()).vendorLinks).toHaveLength(1);});
test('amendment preview exposes disposition conflict without saving',async()=>{await amendment('remove',a);await create().expect(201);const before=JSON.stringify(await saved());const r=await request(app).get(`/contracts/${c.id}/amendments/0/preview`).set(headers()).expect(200);expect(r.body.data.coverageDisposition).toMatchObject({isConsistent:false,anomalies:[{outOfCoverageAssetIds:[String(a)]}]});expect(JSON.stringify(await saved())).toBe(before);});

// #11 consumes live #20 assessments; raw prices and vendor overlays never reprice them.
const lifecycleRead=()=>request(app).get(`/contracts/${c.id}/lifecycle-intelligence`).set(headers());
test('missing assessment keeps covered denominator and incomplete capital',async()=>{
 const missing=id();c=await seed({coveredAssets:[a,missing]});const r=(await lifecycleRead().expect(200)).body;
 expect(r.population).toMatchObject({populationAssetCount:2,assessedAssetCount:1,unavailableAssessmentCount:1});
 expect(r.capital.replacementValue).toMatchObject({total:null,missingAssetCount:2});
 expect(r.replacementReview).toMatchObject({insufficientDataCount:1,unavailableAssessmentCount:1,notRecommendedCount:0});
 expect(r.members.find(row=>row.assetId===String(missing))).toMatchObject({asset:null,reason:'asset_unavailable'});
});
test('purchase and stored metrics cannot become canonical replacement estimates',async()=>{
 await A.collection.updateOne({_id:new cm.Types.ObjectId(String(a))},{$set:{purchase:{price:100000,currency:'USD'},metrics:{currentBookValue:100,estimatedReplacementValue:999,replacementRecommended:true}}});
 const r=(await lifecycleRead().expect(200)).body;expect(r.capital.replacementValue).toMatchObject({knownSubtotal:0,total:null,valuedAssetCount:0});expect(r.summary.estimatedReplacementValue).toBeNull();expect(r.replacementReview.recommendedCount).toBe(0);
});
test('benchmark replacement remains separate, with currency evidence unknown',async()=>{
 const template=await T.create({manufacturer:'Synthetic',model:'Pump',benchmark:{averageQuotedPrice:100000}});
 await A.collection.updateOne({_id:new cm.Types.ObjectId(String(a))},{$set:{templateId:template._id}});
 const r=(await lifecycleRead().expect(200)).body;expect(r.capital.replacementValue).toMatchObject({knownSubtotal:100000,total:null,currency:null,currencyUnknownAssetCount:1});expect(r.capital.estimatedDepreciatedValue).toMatchObject({knownSubtotal:0,total:null,missingAssetCount:1});
});
test('tri-state recommendation counts use canonical adopted policy',async()=>{
 const third=id();c=await seed({coveredAssets:[a,b,third]});
 const policy={sourceType:'asset_override',expectedLifeYears:5,reference:'synthetic',approvedBy:new cm.Types.ObjectId(String(actor)),approvedAt:new Date('2025-01-01')};
 await A.collection.updateOne({_id:new cm.Types.ObjectId(String(a))},{$set:{serviceStartDate:new Date('2000-01-01'),lifecyclePolicy:policy}});
 await A.collection.updateOne({_id:new cm.Types.ObjectId(String(b))},{$set:{serviceStartDate:new Date(),lifecyclePolicy:policy}});
 await A.collection.insertOne({_id:new cm.Types.ObjectId(String(third)),facilityId:new cm.Types.ObjectId(String(facility)),ctrlNumber:'C'});
 const r=(await lifecycleRead().expect(200)).body;expect(r.replacementReview).toMatchObject({populationAssetCount:3,recommendedCount:1,notRecommendedCount:1,insufficientDataCount:1,evaluatedCount:2,recommendedPercentOfEvaluated:50});expect(r.replacementCandidates.map(row=>row._id)).toEqual([String(a)]);
});
test('empty Contract population percentages null',async()=>{c=await seed({coveredAssets:[]});const r=(await lifecycleRead().expect(200)).body;expect(r.summary.replacementRecommendedPercent).toBeNull();expect(r.replacementReview.recommendedPercentOfEvaluated).toBeNull();});
test('upstream outage fails without fake complete zero totals',async()=>{axios.create.mockImplementation(()=>({post:async()=>{throw new Error('synthetic unavailable');}}));const r=(await lifecycleRead().expect(503)).body;expect(r.population.unavailableAssessmentCount).toBe(1);expect(r.capital).toBeUndefined();});
