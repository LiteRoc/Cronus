import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const require = createRequire(import.meta.url),
  m = require('mongoose');
let app, h, W, P, rates, mut, engine, repair, imports, org, f, other, actor, asset;
const secret = 'synthetic-costs-only',
  id = () => new m.Types.ObjectId();
jest.setTimeout(120000);
const admin = () => ({
  id: String(actor),
  role: 'admin'
});
const headers = (role = 'technician', facility = f) => ({
  'x-facility-id': String(facility),
  Authorization: `Bearer ${jwt.sign({
    sub: String(actor),
    role,
    facilityId: String(facility),
    facilities: [String(facility)]
  }, secret, {
    issuer: 'cronus.api',
    audience: 'cronus.app'
  })}`
});
const native = () => mut.createNative({
  facilityId: f,
  assetId: asset,
  description: 'Synthetic',
  createdBy: actor
});
const publish = (rate = 75, revision = 0) => rates.publish({
  organizationId: org,
  expectedRevision: revision,
  reason: 'Synthetic approval',
  periods: [{
    effectiveFrom: '2024-01-01',
    effectiveTo: '2025-01-01',
    rate,
    evidenceRef: 'synthetic'
  }]
}, admin());
beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  h = await createIsolatedMongoHarness(m);
  W = require('../../models/WorkOrder');
  P = require('../../models/Part');
  rates = require('../../services/internalCostRates');
  mut = require('../../services/workOrderCosts/mutate');
  engine = require('../../services/workOrderCosts/calculate');
  repair = require('../../services/workOrderCosts/repair');
  imports = require('../../services/workOrderCosts/import');
  app = express();
  app.use(express.json());
  app.use('/workorders', require('../workOrderRouter'));
  app.use('/rates', require('../internalCostRateRouter'));
  org = id();
  f = id();
  other = id();
  actor = id();
  asset = id();
  await m.model('Organization').create({
    _id: org,
    name: 'Synthetic network'
  });
  await m.model('Facility').create([{
    _id: f,
    organizationId: org,
    name: 'A',
    timezone: 'America/New_York'
  }, {
    _id: other,
    organizationId: org,
    name: 'B',
    timezone: 'UTC'
  }]);
  await m.connection.collection('assets').insertOne({
    _id: asset,
    facilityId: f
  });
});
afterEach(async () => {
  await W.deleteMany({});
  await P.deleteMany({});
  await m.connection.collection('internalcostrateschedules').deleteMany({});
});
afterAll(async () => h?.stop());
test('harness refuses configured target', async () => {
  await expect(m.connect(process.env.MONGO_URI)).rejects.toThrow('not issued');
});
test('B captures 40 x 2; catalog and quantity changes preserve unit snapshot', async () => {
  const w = await native(),
    p = await P.create({
      partNumber: 'B',
      description: 'Synthetic',
      price: 40,
      quantityOnHand: 10
    });
  expect((await request(app).post(`/workorders/${w.id}/parts`).set(headers()).send({
    partId: p.id,
    quantity: 2
  })).status).toBe(201);
  let r = await W.findById(w.id).lean();
  expect(r.partsUsed[0]).toMatchObject({
    unitCost: 40,
    extendedCost: 80
  });
  expect(r.costs.scopes.internal.total).toBe(80);
  await P.updateOne({
    _id: p.id
  }, {
    $set: {
      price: 60
    }
  });
  expect((await request(app).put(`/workorders/${w.id}/parts/${p.id}`).set(headers()).send({
    quantity: 3
  })).status).toBe(200);
  r = await W.findById(w.id).lean();
  expect(r.partsUsed[0]).toMatchObject({
    unitCost: 40,
    extendedCost: 120
  });
  expect(engine.read(r).cacheState).toBe('current');
});
test('C deletes priced labor and synchronizes revision', async () => {
  await publish();
  const w = await native();
  expect((await request(app).post(`/workorders/${w.id}/time-logs`).set(headers()).send({
    timeSpent: 60,
    workDate: '2024-06-01'
  })).status).toBe(200);
  let r = await W.findById(w.id).lean();
  expect(r.timeLogs[0]).toMatchObject({
    laborRate: 75,
    laborCost: 75
  });
  expect(r.timeLogs[0].userId).toBeInstanceOf(m.Types.ObjectId);
  expect((await request(app).delete(`/workorders/${w.id}/time-logs/${r.timeLogs[0]._id}`).set(headers())).status).toBe(200);
  r = await W.findById(w.id).lean();
  expect(r.costs.labor).toBe(0);
  expect(r.economics.revision).toBe(3);
  expect(r.costs.inputRevision).toBe(3);
});
test('network rate shared; gaps unknown and changed schedule does not reprice', async () => {
  await publish();
  expect((await rates.resolve(other, '2024-06-01')).rate).toBe(75);
  expect(await rates.resolve(f, '2025-01-01')).toBeNull();
  const w = await native();
  await request(app).post(`/workorders/${w.id}/time-logs`).set(headers()).send({
    timeSpent: 60,
    workDate: '2024-06-01'
  });
  await publish(100, 1);
  await request(app).post(`/workorders/${w.id}/time-logs`).set(headers()).send({
    timeSpent: 60,
    workDate: '2026-06-01'
  });
  const r = await W.findById(w.id).lean();
  expect(r.timeLogs.map(x => x.laborRate)).toEqual([75, null]);
  expect(r.costs.scopes.internal).toMatchObject({
    knownSubtotal: 75,
    total: null,
    isComplete: false
  });
});
test('known zero distinct from catalog zero and unpriced travel', async () => {
  await publish(0);
  const w = await native();
  await request(app).post(`/workorders/${w.id}/time-logs`).set(headers()).send({
    timeSpent: 60,
    workDate: '2024-06-01'
  });
  expect((await W.findById(w.id).lean()).costs.total).toBe(0);
  const p = await P.create({
    partNumber: 'Z',
    description: 'Synthetic',
    price: 0,
    quantityOnHand: 1
  });
  await request(app).post(`/workorders/${w.id}/parts`).set(headers()).send({
    partId: p.id,
    quantity: 1
  });
  await request(app).post(`/workorders/${w.id}/travel-logs`).set(headers()).send({
    travelTime: 30
  });
  const r = await W.findById(w.id).lean();
  expect(r.partsUsed[0].unitCost).toBeNull();
  expect(r.costs.scopes.internal.total).toBeNull();
});
test('non-economic mutation preserves revision and calculation timestamp', async () => {
  const w = await native();
  expect((await request(app).put(`/workorders/${w.id}`).set(headers()).send({
    description: 'Changed'
  })).status).toBe(200);
  expect((await request(app).patch(`/workorders/${w.id}/status`).set(headers()).send({
    status: 'Completed'
  })).status).toBe(200);
  const r = await W.findById(w.id).lean();
  expect(r.economics.revision).toBe(1);
  expect(r.costs.calculatedAt).toEqual(w.costs.calculatedAt);
});
test('concurrent mutations conflict', async () => {
  const w = await native();
  let n = 0,
    release;
  const barrier = new Promise(r => release = r);
  const action = async row => {
    if (++n === 2) release();
    await barrier;
    row.travelLogs.push({
      _id: id(),
      userId: actor,
      travelTime: 5
    });
  };
  const results = await Promise.allSettled([mut.mutate({
    _id: w.id
  }, admin(), action), mut.mutate({
    _id: w.id
  }, admin(), action)]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(r => r.status === 'rejected').reason.status).toBe(409);
});
test('admin publication and injection guards', async () => {
  const body = {
    expectedRevision: 0,
    reason: 'Synthetic',
    periods: [{
      effectiveFrom: '2024-01-01',
      rate: 75,
      evidenceRef: 'Synthetic'
    }]
  };
  expect((await request(app).post('/rates/publish').set(headers()).send(body)).status).toBe(403);
  expect((await request(app).post('/rates/publish').set(headers('admin')).send({
    ...body,
    approvedBy: String(actor)
  })).status).toBe(400);
  expect((await request(app).post('/rates/publish').set(headers('admin')).send(body)).status).toBe(201);
  const w = await native();
  for (const extra of [{
    laborRate: 500
  }, {
    pricing: {}
  }, {
    costs: {}
  }, {
    userId: String(actor)
  }]) expect((await request(app).post(`/workorders/${w.id}/time-logs`).set(headers()).send({
    timeSpent: 10,
    ...extra
  })).status).toBe(400);
  expect((await request(app).post(`/workorders/${w.id}/time-logs`).set(headers('technician', other)).send({
    timeSpent: 10
  })).status).toBe(404);
  await expect(W.updateOne({
    _id: w.id
  }, {
    $set: {
      'costs.total': 50
    }
  })).rejects.toThrow('canonical');
});
test('stale reads and repair preview/idempotence; legacy remains ambiguous', async () => {
  const w = await native();
  await W.collection.updateOne({
    _id: w._id
  }, {
    $set: {
      'costs.total': 99
    }
  });
  const raw = await W.findById(w.id).lean();
  expect(engine.read(raw).cacheState).toBe('stale');
  const plan = repair.preview(raw);
  expect(plan.classification).toBe('repairable');
  expect((await W.findById(w.id).lean()).costs.total).toBe(99);
  expect(await repair.apply(plan, admin())).toBe('repaired');
  expect(await repair.apply(plan, admin())).toBe('no-op');
  expect(engine.read({
    _id: id(),
    timeLogs: [],
    partsUsed: [],
    costs: {
      total: 0
    }
  }).scopes.internal.total).toBeNull();
});
test('import preserves unknown and vendor evidence, no duplicate or double counting', async () => {
  const source = {
    system: 'synthetic',
    recordId: '1',
    documentRef: 'synthetic',
    facilityId: String(f),
    completeScopes: ['labor', 'parts', 'travel', 'vendor']
  };
  const payload = {
    assetId: String(asset),
    description: 'Synthetic import',
    timeLogs: [{
      timeSpent: 60,
      workDate: '2020-01-01'
    }],
    vendorService: {
      totalCost: 100,
      evidence: {
        totalCost: {
          reference: 'invoice'
        }
      },
      attribution: {
        status: 'attributable',
        evidenceRef: 'invoice'
      }
    }
  };
  const r = await imports.importWorkOrder(payload, source, admin());
  expect(r.workOrder.costs.scopes.vendorDirect.total).toBe(100);
  expect(r.workOrder.costs.scopes.directMaintenance).toMatchObject({
    knownSubtotal: 100,
    total: null
  });
  expect((await imports.importWorkOrder(payload, source, admin())).action).toBe('no-op');
  const v = r.workOrder.vendorService;
  v.breakdownComplete = true;
  v.pricing.components = {};
  for (const key of ['laborCost', 'travelCost', 'partsCost', 'shippingCost']) {
    v[key] = 30;
    v.pricing.components[key] = v.pricing.total;
  }
  expect(engine.calculate({
    ...r.workOrder,
    vendorService: v
  }).scopes.vendorDirect.total).toBeNull();
});
test('rate periods reject overlap, publication is immutable, and organizations remain isolated', async () => {
  await publish();
  await expect(publish(90, 0)).rejects.toMatchObject({
    status: 409
  });
  await expect(rates.publish({
    organizationId: org,
    expectedRevision: 1,
    reason: 'Invalid overlap',
    periods: [{
      effectiveFrom: '2024-01-01',
      effectiveTo: '2025-01-01',
      rate: 75,
      evidenceRef: 'a'
    }, {
      effectiveFrom: '2024-06-01',
      rate: 80,
      evidenceRef: 'b'
    }]
  }, admin())).rejects.toMatchObject({
    status: 400
  });
  const schedule = await m.model('InternalCostRateSchedule').findOne({
    organizationId: org
  }).lean();
  await publish(90, 1);
  const updated = await m.model('InternalCostRateSchedule').findById(schedule._id).lean();
  expect(updated.publishedRevisions[0]).toEqual(schedule.publishedRevisions[0]);
  await expect(m.model('InternalCostRateSchedule').deleteOne({
    _id: schedule._id
  })).rejects.toThrow('governed');
  const alienOrg = id(),
    alienFacility = id();
  await m.model('Organization').create({
    _id: alienOrg,
    name: 'Other network'
  });
  await m.model('Facility').create({
    _id: alienFacility,
    organizationId: alienOrg,
    name: 'Other'
  });
  expect(await rates.resolve(alienFacility, '2024-06-01')).toBeNull();
  expect(await rates.workDate(f, undefined, new Date('2024-06-01T02:00:00Z'))).toBe('2024-05-31');
  expect(await rates.workDate(other, undefined, new Date('2024-06-01T02:00:00Z'))).toBe('2024-06-01');
});
test('legacy economic mutation preserves untouched raw snapshots and read does not write', async () => {
  const raw = {
    _id: id(),
    facilityId: f,
    assetId: asset,
    description: 'Legacy',
    timeLogs: [{
      _id: id(),
      userId: actor,
      timeSpent: 60,
      laborRate: 0,
      laborCost: 0
    }],
    partsUsed: [],
    travelLogs: [],
    costs: {
      labor: 0,
      parts: 0,
      total: 0
    }
  };
  await W.collection.insertOne(raw);
  const before = await W.collection.findOne({
    _id: raw._id
  });
  engine.read(before);
  expect(await W.collection.findOne({
    _id: raw._id
  })).toEqual(before);
  const p = await P.create({
    partNumber: 'legacy',
    description: 'Synthetic',
    price: 40,
    quantityOnHand: 2
  });
  await request(app).post(`/workorders/${raw._id}/parts`).set(headers()).send({
    partId: p.id,
    quantity: 2
  }).expect(201);
  const after = await W.collection.findOne({
    _id: raw._id
  });
  expect(after.timeLogs).toEqual(before.timeLogs);
  expect(after.economics.origin).toBe('legacy_mixed');
  expect(engine.read(after).scopes.internal).toMatchObject({
    knownSubtotal: 80,
    total: null
  });
});
test('note-only and no-op Part updates preserve revision and captured rates', async () => {
  const w = await native(),
    p = await P.create({
      partNumber: 'note',
      description: 'Synthetic',
      price: 40,
      quantityOnHand: 2
    });
  await request(app).post(`/workorders/${w.id}/parts`).set(headers()).send({
    partId: p.id,
    quantity: 2
  }).expect(201);
  const before = await W.findById(w.id).lean();
  await request(app).put(`/workorders/${w.id}/parts/${p.id}`).set(headers()).send({
    quantity: 2,
    note: 'Note only'
  }).expect(200);
  const after = await W.findById(w.id).lean();
  expect(after.economics).toEqual(before.economics);
  expect(after.costs).toEqual(before.costs);
});
test('vendor reconciliation counts an invoice once and requires documented zero/attribution', () => {
  const p = {
    version: 1,
    basis: 'documented',
    sourceKind: 'invoice',
    sourceId: 'synthetic',
    capturedBy: String(actor),
    capturedAt: new Date(),
    zeroEvidence: true
  };
  const v = {
    totalCost: 100,
    laborCost: 40,
    travelCost: 20,
    partsCost: 30,
    shippingCost: 10,
    breakdownComplete: true,
    attribution: {
      status: 'attributable',
      evidenceRef: 'invoice',
      recordedBy: String(actor)
    },
    pricing: {
      total: p,
      components: Object.fromEntries(['laborCost', 'travelCost', 'partsCost', 'shippingCost'].map(k => [k, p]))
    }
  };
  const w = {
    economics: {
      schemaVersion: 1,
      revision: 1,
      origin: 'native'
    },
    vendorService: v
  };
  expect(engine.calculate(w).scopes.vendorDirect).toMatchObject({
    total: 100,
    reconciliation: 'matched'
  });
  delete v.pricing.total;
  expect(engine.calculate(w).scopes.vendorDirect.total).toBe(100);
  v.partsCost = null;
  expect(engine.calculate(w).scopes.vendorDirect).toMatchObject({
    knownSubtotal: 70,
    total: null
  });
  v.attribution.status = 'unresolved';
  expect(engine.calculate(w).scopes.vendorDirect).toMatchObject({
    knownSubtotal: 0,
    total: null
  });
  v.attribution.status = 'covered_elsewhere';
  expect(engine.calculate(w).scopes.vendorDirect.total).toBeNull();
  v.attribution.knownZero = true;
  expect(engine.calculate(w).scopes.vendorDirect.total).toBe(0);
});
test('repair refuses economic races, legacy, and inconsistent snapshots', async () => {
  const w = await native();
  await W.collection.updateOne({
    _id: w._id
  }, {
    $set: {
      'costs.total': 99
    }
  });
  const plan = repair.preview(await W.findById(w.id).lean());
  await request(app).post(`/workorders/${w.id}/travel-logs`).set(headers()).send({
    travelTime: 5
  }).expect(200);
  await expect(repair.apply(plan, admin())).rejects.toThrow('inputs changed');
  expect(repair.preview({
    _id: id(),
    facilityId: f,
    timeLogs: [{
      laborRate: 75,
      laborCost: 75,
      timeSpent: 60
    }]
  }).classification).toBe('legacy_ambiguous');
});
test('lifecycle totals preserve partial economics and complete coverage counts', async () => {
  const lifecycle = require('../../services/lifecycleMaintenance').default;
  await publish();
  const w = await native();
  await request(app).post(`/workorders/${w.id}/time-logs`).set(headers()).send({
    timeSpent: 60,
    workDate: '2024-06-01'
  }).expect(200);
  await request(app).post(`/workorders/${w.id}/travel-logs`).set(headers()).send({
    travelTime: 5
  }).expect(200);
  await request(app).patch(`/workorders/${w.id}/status`).set(headers()).send({
    status: 'Completed'
  }).expect(200);
  const result = await lifecycle.getMaintenanceTotals(asset, {
    facilityId: f
  });
  expect(result.lifetime.scopes.directMaintenance).toMatchObject({
    knownSubtotal: 75,
    total: null,
    fullyPricedCount: 0,
    workOrderCount: 1
  });
  const empty = await lifecycle.getMaintenanceTotals(asset, {
    facilityId: other
  });
  expect(empty.lifetime.count).toBe(0);
  const metrics = require('../../utils/lifecycle').computeLifecycleMetrics({
    asset: {
      purchaseCost: 100,
      purchaseDate: '2025-01-01'
    },
    maintenanceScopes: {
      last12Months: result.last12Months.scopes
    }
  });
  expect(metrics.replacementRecommended).toBe(false);
  expect(metrics.costRecommendationStatus).toBe('insufficient_economic_data');
});
test('import refuses protected aggregates, invalid Facility, and ambiguous source zero', async () => {
  const source = {
    system: 'synthetic',
    recordId: 'zero',
    documentRef: 'source',
    facilityId: String(f),
    completeScopes: ['labor', 'parts', 'travel', 'vendor']
  };
  const p = await P.create({
    partNumber: 'import',
    description: 'Synthetic',
    price: 60,
    quantityOnHand: 2
  });
  const payload = {
    assetId: String(asset),
    description: 'Historical',
    partsUsed: [{
      partId: p.id,
      quantity: 2,
      unitCost: 0
    }]
  };
  await expect(imports.prepare({
    ...payload,
    costs: {}
  }, source, admin())).rejects.toMatchObject({
    status: 400
  });
  await expect(imports.prepare(payload, {
    ...source,
    facilityId: String(other)
  }, admin())).rejects.toMatchObject({
    status: 404
  });
  const result = await imports.importWorkOrder(payload, source, admin());
  expect(result.workOrder.partsUsed[0].unitCost).toBeNull();expect(result.workOrder.partsUsed[0].pricing.reportedValue).toBe(0);
  expect(result.workOrder.costs.scopes.internal.total).toBeNull();
  await expect(imports.importWorkOrder({
    ...payload,
    description: 'Correction'
  }, source, admin())).rejects.toMatchObject({
    status: 409
  });
});
test('deterministic currency rounding and unsupported caches never invent history', () => {
  expect(engine.amount(1, 1.005)).toBe(1.01);
  expect(engine.amount(1, 75, 60)).toBe(1.25);
  const r = engine.read({
    economics: {
      schemaVersion: 99,
      revision: 1
    },
    costs: {
      total: 100
    }
  });
  expect(r.cacheState).toBe('unsupported');
  expect(r.scopes.directMaintenance.total).toBeNull();
});
test('repeated Part usages retain separate snapshots and deletion addresses only one usage', async () => {
  const w = await native(),
    p = await P.create({
      partNumber: 'repeat',
      description: 'Synthetic',
      price: 40,
      quantityOnHand: 3
    });
  await request(app).post(`/workorders/${w.id}/parts`).set(headers()).send({
    partId: p.id,
    quantity: 1
  }).expect(201);
  await P.updateOne({
    _id: p.id
  }, {
    $set: {
      price: 60
    }
  });
  await request(app).post(`/workorders/${w.id}/parts`).set(headers()).send({
    partId: p.id,
    quantity: 1
  }).expect(201);
  const before = await W.findById(w.id).lean();
  expect(before.partsUsed.map(p => p.unitCost)).toEqual([40, 60]);
  await request(app).delete(`/workorders/${w.id}/parts/${p.id}`).set(headers()).expect(409);
  await request(app).delete(`/workorders/${w.id}/part-usages/${before.partsUsed[0]._id}`).set(headers()).expect(200);
  const after = await W.findById(w.id).lean();
  expect(after.partsUsed).toHaveLength(1);
  expect(after.costs.parts).toBe(60);
});

test('non-economic document save preserves legacy raw economics',async()=>{
  const raw={_id:id(),facilityId:f,assetId:asset,description:'Legacy save',timeLogs:[{_id:id(),userId:actor,timeSpent:60,laborRate:0,laborCost:0}],partsUsed:[],travelLogs:[],costs:{total:0}};
  await W.collection.insertOne(raw);
  await request(app).post(`/workorders/${raw._id}/test-equipment`).set(headers()).send({equipmentId:String(asset)}).expect(200);
  const after=await W.collection.findOne({_id:raw._id});expect(after.timeLogs).toEqual(raw.timeLogs);expect(after.costs).toEqual(raw.costs);expect(after.economics).toBeUndefined();
});

test('imports reject foreign currency instead of silently converting it',async()=>{
  const source={system:'synthetic',recordId:'currency',documentRef:'source',facilityId:String(f),currency:'EUR'};
  await expect(imports.prepare({assetId:String(asset),description:'Currency'},source,admin())).rejects.toMatchObject({status:400});
});
