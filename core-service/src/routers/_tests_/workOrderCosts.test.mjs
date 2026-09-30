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
  app.use('/internal-cost-rates', require('../internalCostRateRouter'));
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
  jest.restoreAllMocks();
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

// #18 amounts are synthetic, never operational rate authority.
const ratePeriod = (effectiveFrom, effectiveTo, rate) => ({ effectiveFrom, effectiveTo, rate, evidenceRef: `synthetic-${rate}` });
const publishPeriods = (periods, expectedRevision = 0) => rates.publish({ organizationId: org, expectedRevision, periods, reason: 'Synthetic #18 approval' }, admin());
const addLabor = async (w, workDate) => {
  await request(app).post(`/workorders/${w.id}/time-logs`).set(headers()).send({ timeSpent: 30, workDate }).expect(200);
  return W.findById(w.id).lean();
};

test('#18 inclusive starts, exclusive adjacent ends and open-ended successor', async () => {
  await publishPeriods([ratePeriod('2026-07-01', '2026-10-01', 40), ratePeriod('2026-10-01', null, 60)]);
  expect(await rates.resolve(f, '2026-06-30')).toBeNull();
  for (const [day, rate] of [['2026-07-01', 40], ['2026-09-30', 40], ['2026-10-01', 60], ['2030-01-01', 60]]) {
    expect(await rates.resolve(f, day)).toMatchObject({ rate, sourceRevision: 1 });
  }
  expect(await rates.resolve(other, '2026-10-01')).toMatchObject({ rate: 60, organizationId: String(org) });
});

test('#18 revisions replace full active period sets, not append-only deltas', async () => {
  await publishPeriods([ratePeriod('2026-10-01', null, 60)]);
  const original = await m.model('InternalCostRateSchedule').findOne({ organizationId: org }).lean();
  await publishPeriods([ratePeriod('2027-01-01', null, 90)], 1);
  expect(await rates.resolve(f, '2026-10-15')).toBeNull();
  expect(await rates.resolve(f, '2027-01-01')).toMatchObject({ rate: 90, sourceRevision: 2 });
  await publishPeriods([ratePeriod('2026-10-01', '2027-01-01', 60), ratePeriod('2027-01-01', null, 90)], 2);
  expect(await rates.resolve(f, '2026-10-15')).toMatchObject({ rate: 60, sourceRevision: 3 });
  expect(await rates.resolve(f, '2027-01-01')).toMatchObject({ rate: 90, sourceRevision: 3 });
  const current = await m.model('InternalCostRateSchedule').findById(original._id).lean();
  expect(current.publishedRevisions[0]).toEqual(original.publishedRevisions[0]);
  expect(current.publishedRevisions.map(p => p.revision)).toEqual([1, 2, 3]);
});

test('#18 competing later publications produce one winner and a stale-revision conflict', async () => {
  await publishPeriods([ratePeriod('2026-10-01', null, 60)]);
  const results = await Promise.allSettled([40, 90].map(rate => publishPeriods([ratePeriod('2026-10-01', null, rate)], 1)));
  const winners = results.filter(r => r.status === 'fulfilled');
  expect(winners).toHaveLength(1);
  expect(results.find(r => r.status === 'rejected').reason).toMatchObject({ status: 409, message: 'Schedule changed' });
  const current = await m.model('InternalCostRateSchedule').findOne({ organizationId: org }).lean();
  expect(current.revision).toBe(2);
  expect(current.publishedRevisions.map(p => p.revision)).toEqual([1, 2]);
  expect(current.publishedRevisions[1].periods).toEqual(winners[0].value.publishedRevisions[1].periods);
});

test('#18 prospective, replacement and historical publications never mutate raw WorkOrders', async () => {
  await publishPeriods([ratePeriod('2026-10-01', null, 60)]);
  const priced = await native(); await addLabor(priced, '2026-10-15');
  const stale = await native(); await addLabor(stale, '2026-10-15');
  await W.collection.updateOne({ _id: stale._id }, { $set: { 'costs.total': 999 } });
  expect(engine.read(await W.findById(stale.id).lean()).cacheState).toBe('stale');
  const completed = await native(); await addLabor(completed, '2026-10-15');
  await request(app).patch(`/workorders/${completed.id}/status`).set(headers()).send({ status: 'Completed' }).expect(200);
  const reopened = await native(); await addLabor(reopened, '2026-10-15');
  for (const status of ['Completed', 'Open']) await request(app).patch(`/workorders/${reopened.id}/status`).set(headers()).send({ status }).expect(200);
  const legacyId = id();
  await W.collection.insertOne({ _id: legacyId, assetId: asset, facilityId: f, status: 'Open',
    timeLogs: [{ _id: id(), userId: actor, timeSpent: 30, workDate: '2026-09-15' }], partsUsed: [], travelLogs: [], costs: { labor: null } });
  const raw = () => W.collection.find({}).sort({ _id: 1 }).toArray();
  const before = await raw();
  for (const [revision, periods] of [
    [1, [ratePeriod('2026-10-01', '2027-01-01', 60), ratePeriod('2027-01-01', null, 90)]],
    [2, [ratePeriod('2026-10-01', '2027-01-01', 90), ratePeriod('2027-01-01', null, 40)]],
    [3, [ratePeriod('2026-07-01', '2026-10-01', 40), ratePeriod('2026-10-01', null, 90)]],
  ]) {
    await publishPeriods(periods, revision);
    expect(await raw()).toEqual(before);
  }
  expect(await rates.resolve(f, '2026-09-15')).toMatchObject({ rate: 40 });
  expect(engine.read(await W.collection.findOne({ _id: legacyId })).components.internalLabor.total).toBeNull();
});

test('#18 backdated labor before prospective coverage stays unknown without fallback', async () => {
  await publishPeriods([ratePeriod('2026-10-01', null, 60)]);
  const row = await addLabor(await native(), '2026-09-15');
  expect(row.timeLogs[0]).toMatchObject({ workDate: '2026-09-15', laborRate: null, laborCost: null,
    pricing: { basis: 'unknown', unknownReason: 'no_applicable_rate' } });
  expect(engine.read(row).components.internalLabor).toMatchObject({ total: null, knownSubtotal: 0, isComplete: false });
});

test('#18 captured rate and provenance survive revision changes; canonical reads never resolve', async () => {
  await publishPeriods([ratePeriod('2026-10-01', null, 60)]);
  const w = await native(), before = await addLabor(w, '2026-10-15');
  expect(before.timeLogs[0]).toMatchObject({ laborRate: 60, laborCost: 30, pricing: { sourceRevision: 1, evidenceRef: 'synthetic-60' } });
  await publishPeriods([ratePeriod('2026-10-01', null, 90)], 1);
  const after = await W.findById(w.id).lean();
  expect(after.timeLogs).toEqual(before.timeLogs);
  const lookup = jest.spyOn(rates, 'resolve').mockImplementation(() => { throw new Error('Read must not resolve'); });
  expect(engine.read(after).components.internalLabor.total).toBe(30);
  expect(lookup).not.toHaveBeenCalled();
});

test('#18 completing and reopening preserve snapshots, economics and cache without lookup', async () => {
  await publishPeriods([ratePeriod('2026-10-01', null, 60)]);
  const w = await native(), before = await addLabor(w, '2026-10-15');
  await publishPeriods([ratePeriod('2026-10-01', null, 90)], 1);
  const lookup = jest.spyOn(rates, 'resolve').mockImplementation(() => { throw new Error('Status must not resolve'); });
  for (const status of ['Completed', 'Open', 'In Progress']) {
    await request(app).patch(`/workorders/${w.id}/status`).set(headers()).send({ status }).expect(200);
    const after = await W.findById(w.id).lean();
    expect(after.timeLogs).toEqual(before.timeLogs);
    expect(after.economics).toEqual(before.economics);
    expect(after.costs).toEqual(before.costs);
    expect(engine.read(after).components.internalLabor.total).toBe(30);
  }
  expect(lookup).not.toHaveBeenCalled();
});

test('#18 rate endpoint authorization, publication audit and server-owned Organization', async () => {
  const body = { expectedRevision: 0, reason: 'Synthetic approval', periods: [ratePeriod('2026-10-01', null, 60)] };
  for (const path of ['/internal-cost-rates', '/internal-cost-rates/publish']) {
    const call = () => path.endsWith('publish') ? request(app).post(path).send(body) : request(app).get(path);
    await call().expect(401);
    for (const role of ['technician', 'customer']) await call().set(headers(role)).expect(403);
  }
  await request(app).post('/internal-cost-rates/publish').set(headers('admin')).send({ ...body, organizationId: String(id()) }).expect(400);
  await request(app).get('/internal-cost-rates').set({ Authorization: headers('admin').Authorization }).expect(400);
  await request(app).post('/internal-cost-rates/publish').set(headers('admin')).send(body).expect(201);
  const result = await request(app).get('/internal-cost-rates').set(headers('admin', other)).expect(200);
  expect(result.body).toMatchObject({ organizationId: String(org), purpose: 'internal_labor_cost', currency: 'USD', revision: 1 });
  expect(result.body.publishedRevisions[0]).toMatchObject({ approvedBy: String(actor), reason: body.reason });
  expect(Number.isFinite(Date.parse(result.body.publishedRevisions[0].approvedAt))).toBe(true);
});

test('#18 ambiguous stored periods cannot create trusted labor or repair stored history', async () => {
  await publishPeriods([ratePeriod('2026-10-01', null, 60)]);
  const Schedule = m.model('InternalCostRateSchedule');
  await Schedule.collection.updateOne({ organizationId: org }, { $push: { 'publishedRevisions.0.periods': ratePeriod('2026-10-10', null, 90) } });
  const corrupt = await Schedule.collection.findOne({ organizationId: org });
  expect(await rates.resolve(f, '2026-10-15')).toBeNull();
  const row = await addLabor(await native(), '2026-10-15');
  expect(row.timeLogs[0]).toMatchObject({ laborRate: null, laborCost: null, pricing: { basis: 'unknown', unknownReason: 'ambiguous_rate_schedule' } });
  expect(engine.read(row).components.internalLabor).toMatchObject({ total: null, isComplete: false });
  expect(await Schedule.collection.findOne({ organizationId: org })).toEqual(corrupt);
});

test.each([
  ['missing periods', p => { delete p.periods; }],
  ['invalid date', p => { p.periods[0].effectiveFrom = '2026-02-30'; }],
  ['invalid rate', p => { p.periods[0].rate = -1; }],
  ['missing evidence', p => { delete p.periods[0].evidenceRef; }],
  ['invalid interval', p => { p.periods[0].effectiveTo = '2026-09-01'; }],
])('#18 malformed stored history (%s) remains unknown', async (_name, corrupt) => {
  await publishPeriods([ratePeriod('2026-10-01', null, 60)]);
  const Schedule = m.model('InternalCostRateSchedule'), raw = await Schedule.collection.findOne({ organizationId: org });
  corrupt(raw.publishedRevisions[0]);
  await Schedule.collection.updateOne({ _id: raw._id }, { $set: { publishedRevisions: raw.publishedRevisions } });
  const row = await addLabor(await native(), '2026-10-15');
  expect(row.timeLogs[0]).toMatchObject({ laborRate: null, laborCost: null, pricing: { basis: 'unknown', unknownReason: 'invalid_rate_schedule' } });
  expect(engine.read(row).components.internalLabor.isComplete).toBe(false);
});

test('#18 duplicate current publications cannot certify a rate', async () => {
  await publishPeriods([ratePeriod('2026-10-01', null, 60)]);
  const Schedule = m.model('InternalCostRateSchedule'), raw = await Schedule.collection.findOne({ organizationId: org });
  await Schedule.collection.updateOne({ _id: raw._id }, { $push: { publishedRevisions: raw.publishedRevisions[0] } });
  const row = await addLabor(await native(), '2026-10-15');
  expect(row.timeLogs[0]).toMatchObject({ laborRate: null, laborCost: null, pricing: { unknownReason: 'ambiguous_rate_schedule' } });
});

test.each([
  ['empty periods', { periods: [] }],
  ['invalid date', { periods: [ratePeriod('invalid', null, 60)] }],
  ['impossible date', { periods: [ratePeriod('2026-02-30', null, 60)] }],
  ['equal end', { periods: [ratePeriod('2026-10-01', '2026-10-01', 60)] }],
  ['earlier end', { periods: [ratePeriod('2026-10-01', '2026-09-30', 60)] }],
  ['negative rate', { periods: [ratePeriod('2026-10-01', null, -1)] }],
  ['nonnumeric rate', { periods: [ratePeriod('2026-10-01', null, '60')] }],
  ['missing reason', { reason: undefined }],
  ['blank reason', { reason: ' ' }],
  ['missing evidence', { periods: [{ effectiveFrom: '2026-10-01', rate: 60 }] }],
  ['unexpected period field', { periods: [{ ...ratePeriod('2026-10-01', null, 60), approvedBy: 'caller' }] }],
  ['unexpected body field', { approvedAt: '2026-10-01' }],
  ['negative revision', { expectedRevision: -1 }],
  ['fractional revision', { expectedRevision: 0.5 }],
  ['string revision', { expectedRevision: '0' }],
  ['missing revision', { expectedRevision: undefined }],
])('#18 publication rejects %s without schedule writes', async (_name, patch) => {
  await request(app).post('/internal-cost-rates/publish').set(headers('admin')).send({
    expectedRevision: 0, reason: 'Synthetic authority', periods: [ratePeriod('2026-10-01', null, 60)], ...patch,
  }).expect(400);
  expect(await m.model('InternalCostRateSchedule').countDocuments({})).toBe(0);
});

// #17 corrections: HTTP contract and canonical economic snapshots.
const laborPatch = (row, body, logId = row.timeLogs[0]._id) => request(app)
  .patch(`/workorders/${row._id}/time-logs/${logId}`).set(headers()).send(body);
const rawWO = row => W.collection.findOne({ _id: row._id });
async function correctionFixture() {
  await publishPeriods([ratePeriod('2026-10-01', '2027-01-01', 100), ratePeriod('2027-01-01', null, 120)]);
  return addLabor(await native(), '2026-12-31');
}
function currentEconomics(row) {
  expect(engine.read(row).cacheState).toBe('current');
  expect(row.costs.inputFingerprint).toBe(engine.fingerprint(row));
  expect(row.costs.inputRevision).toBe(row.economics.revision);
}
test('#17 description-only preserves all economics and original creation identity without lookup', async () => {
  const row = await correctionFixture(), before = await rawWO(row);
  const lookup = jest.spyOn(rates, 'resolve');
  const response = await laborPatch(row, { description: 'Corrected description' }).expect(200);
  const after = await rawWO(row);
  expect(after.timeLogs[0]).toEqual({ ...before.timeLogs[0], description: 'Corrected description' });
  expect(after.costs).toEqual(before.costs); expect(after.economics).toEqual(before.economics);
  expect(String(after.updatedBy)).toBe(String(actor));
  expect(response.body.workOrder.costs.cacheState).toBe('current');
  expect(lookup).not.toHaveBeenCalled();
});
test.each([{ timeSpent: 90 }, { timeSpent: 90, description: 'Corrected minutes' },
  { timeSpent: 90, workDate: '2026-12-31' }])('#17 minutes retain captured authority despite later publication: %j', async body => {
  const row = await correctionFixture(), before = await rawWO(row);
  await publishPeriods([ratePeriod('2026-10-01', null, 200)], 1);
  const lookup = jest.spyOn(rates, 'resolve');
  await laborPatch(row, body).expect(200);
  const after = await rawWO(row), entry = after.timeLogs[0];
  expect(entry).toEqual({ ...before.timeLogs[0], ...body, laborCost: 150 });
  expect(entry.pricing).toEqual(before.timeLogs[0].pricing);
  expect(after.economics.revision).toBe(before.economics.revision + 1);
  expect(after.costs.labor).toBe(150); currentEconomics(after);
  expect(lookup).not.toHaveBeenCalled();
});
test('#17 minute correction uses deterministic cent rounding', async () => {
  await publishPeriods([ratePeriod('2026-10-01', null, 100)]);
  const row = await addLabor(await native(), '2026-12-31');
  await laborPatch(row, { timeSpent: 1 }).expect(200);
  const after = await rawWO(row);
  expect(after.timeLogs[0].laborCost).toBe(1.67); currentEconomics(after);
});
test('#17 explicitly approved zero remains known during minute correction', async () => {
  await publishPeriods([ratePeriod('2026-10-01', null, 0)]);
  const row = await addLabor(await native(), '2026-12-31');
  const lookup = jest.spyOn(rates, 'resolve');
  await laborPatch(row, { timeSpent: 90 }).expect(200);
  const after = await rawWO(row);
  expect(after.timeLogs[0]).toMatchObject({ laborRate: 0, laborCost: 0 });
  expect(after.costs.components.internalLabor).toMatchObject({ total: 0, isComplete: true });
  expect(lookup).not.toHaveBeenCalled(); currentEconomics(after);
});
test.each([
  ['same period', { workDate: '2026-12-30' }, 100, 50, '2026-10-01'],
  ['new period', { workDate: '2027-01-01' }, 120, 60, '2027-01-01'],
  ['minutes and date', { timeSpent: 90, workDate: '2027-01-01' }, 120, 180, '2027-01-01'],
  ['description and date', { description: 'Corrected date', workDate: '2027-01-01' }, 120, 60, '2027-01-01'],
])('#17 date correction resolves %s and captures current authority', async (_name, body, rate, cost, from) => {
  const row = await correctionFixture(), before = await rawWO(row);
  await publishPeriods([ratePeriod('2026-10-01', '2027-01-01', 100), ratePeriod('2027-01-01', null, 120)], 1);
  const lookup = jest.spyOn(rates, 'resolve');
  await laborPatch(row, body).expect(200);
  const after = await rawWO(row), entry = after.timeLogs[0];
  expect(entry).toMatchObject({ ...body, laborRate: rate, laborCost: cost,
    pricing: { sourceRevision: 2, organizationId: String(org), effectiveFrom: from } });
  expect(entry._id).toEqual(before.timeLogs[0]._id);
  expect(entry.userId).toEqual(before.timeLogs[0].userId);
  expect(entry.createdAt).toEqual(before.timeLogs[0].createdAt);
  expect(entry.pricing).not.toEqual(before.timeLogs[0].pricing);
  expect(lookup).toHaveBeenCalledTimes(1); expect(lookup.mock.calls[0].slice(0,2)).toEqual([f, body.workDate]);
  expect(after.economics.revision).toBe(before.economics.revision + 1); currentEconomics(after);
});
test('#17 date correction into a gap removes old authority without fallback', async () => {
  const row = await correctionFixture();
  await laborPatch(row, { workDate: '2026-09-30' }).expect(200);
  const after = await rawWO(row);
  expect(after.timeLogs[0]).toMatchObject({ laborRate: null, laborCost: null,
    pricing: { basis: 'unknown', unknownReason: 'no_applicable_rate' } });
  expect(after.timeLogs[0].pricing.sourceId).toBeUndefined();
  expect(after.costs.components.internalLabor).toMatchObject({ total: null, isComplete: false }); currentEconomics(after);
});
test.each(['overlap', 'duplicate revision', 'corrupt period'])('#17 date correction fails closed for %s', async kind => {
  const row = await correctionFixture(), Schedule = m.model('InternalCostRateSchedule');
  const raw = await Schedule.collection.findOne({ organizationId: org });
  if (kind === 'overlap') raw.publishedRevisions[0].periods.push(ratePeriod('2027-01-01', null, 200));
  else if (kind === 'duplicate revision') raw.publishedRevisions.push(raw.publishedRevisions[0]);
  else raw.publishedRevisions[0].periods[0].rate = -1;
  await Schedule.collection.updateOne({ _id: raw._id }, { $set: { publishedRevisions: raw.publishedRevisions } });
  const beforeSchedule = await Schedule.collection.findOne({ _id: raw._id });
  await laborPatch(row, { workDate: '2027-01-01' }).expect(200);
  const after = await rawWO(row);
  expect(after.timeLogs[0]).toMatchObject({ laborRate: null, laborCost: null,
    pricing: { basis: 'unknown', unknownReason: kind === 'corrupt period' ? 'invalid_rate_schedule' : 'ambiguous_rate_schedule' } });
  expect(after.costs.components.internalLabor.isComplete).toBe(false); currentEconomics(after);
  expect(await Schedule.collection.findOne({ _id: raw._id })).toEqual(beforeSchedule);
});
test.each([{}, { description: '' }, { timeSpent: 30, workDate: '2026-12-31', description: '' }])('#17 no effective change preserves raw record and does not resolve: %j', async body => {
  const row = await correctionFixture(), before = await rawWO(row);
  const lookup = jest.spyOn(rates, 'resolve');
  await laborPatch(row, body).expect(200);
  expect(await rawWO(row)).toEqual(before); expect(lookup).not.toHaveBeenCalled();
});
async function legacyLabor(kind) {
  const row = await native();
  const entry = { _id: id(), userId: actor, timeSpent: 60, description: 'Legacy', createdAt: new Date('2020-01-01') };
  if (kind === 'unknown') Object.assign(entry, { workDate: '2026-12-31', laborRate: null, laborCost: null,
    pricing: { basis: 'unknown', unknownReason: 'legacy_authority_unknown' } });
  if (kind === 'unverified numeric') Object.assign(entry, { laborRate: 50, laborCost: 50 });
  await W.collection.updateOne({ _id: row._id }, { $set: { timeLogs: [entry] }, $unset: { economics: '', costs: '' } });
  return rawWO(row);
}
test.each(['missing', 'unknown', 'unverified numeric'])('#17 legacy %s minutes stay unpriced despite published authority', async kind => {
  const row = await legacyLabor(kind), before = await rawWO(row);
  await publishPeriods([ratePeriod('2026-10-01', null, 100)]);
  const lookup = jest.spyOn(rates, 'resolve');
  await laborPatch(row, { timeSpent: 90 }).expect(200);
  const after = await rawWO(row);
  expect(after.timeLogs[0]).toEqual({ ...before.timeLogs[0], timeSpent: 90, laborRate: null, laborCost: null });
  expect(after.costs.components.internalLabor.isComplete).toBe(false);
  expect(after.economics.origin).toBe('legacy_mixed'); currentEconomics(after);
  expect(lookup).not.toHaveBeenCalled();
});
test.each(['missing', 'unknown', 'unverified numeric'])('#17 legacy %s description edit preserves raw economic fields', async kind => {
  const row = await legacyLabor(kind), before = await rawWO(row);
  const lookup = jest.spyOn(rates, 'resolve');
  await laborPatch(row, { description: 'Fixed metadata' }).expect(200);
  const after = await rawWO(row);
  expect(after.timeLogs[0]).toEqual({ ...before.timeLogs[0], description: 'Fixed metadata' });
  expect(after.economics).toEqual(before.economics); expect(after.costs).toEqual(before.costs);
  expect(engine.read(after).components.internalLabor.isComplete).toBe(false); expect(lookup).not.toHaveBeenCalled();
});
test.each([['2027-01-01', 100], ['2026-09-30', null]])('#17 explicit legacy date correction %s resolves governed entry authority', async (day, rate) => {
  const row = await legacyLabor('missing');
  await publishPeriods([ratePeriod('2026-10-01', null, 100)]);
  const lookup = jest.spyOn(rates, 'resolve');
  await laborPatch(row, { workDate: day }).expect(200);
  const after = await rawWO(row);
  expect(after.timeLogs[0]).toMatchObject({ workDate: day, laborRate: rate, laborCost: rate });
  expect(after.timeLogs[0].pricing.basis).toBe(rate === null ? 'unknown' : 'blended_internal');
  // Legacy whole-record scope remains unresolved; this is not bulk repair.
  expect(after.economics.origin).toBe('legacy_mixed'); expect(lookup).toHaveBeenCalledTimes(1); currentEconomics(after);
});
test('#17 later publications, completion, reopen and archive preserve edited snapshot', async () => {
  const row = await correctionFixture();
  await laborPatch(row, { timeSpent: 90 }).expect(200);
  const before = await rawWO(row);
  await publishPeriods([ratePeriod('2026-10-01', null, 200)], 1);
  expect(await rawWO(row)).toEqual(before);
  const lookup = jest.spyOn(rates, 'resolve');
  for (const status of ['Completed', 'Open', 'In Progress']) {
    await request(app).patch(`/workorders/${row._id}/status`).set(headers()).send({ status }).expect(200);
  }
  await request(app).patch(`/workorders/${row._id}/archive`).set(headers('admin')).expect(200);
  const after = await rawWO(row);
  expect(after.timeLogs).toEqual(before.timeLogs); expect(after.costs).toEqual(before.costs);
  expect(after.economics).toEqual(before.economics); expect(lookup).not.toHaveBeenCalled();
});
test('#17 delete/re-add remains a new event with current lookup', async () => {
  const row = await correctionFixture(), old = row.timeLogs[0];
  await publishPeriods([ratePeriod('2026-10-01', null, 200)], 1);
  const lookup = jest.spyOn(rates, 'resolve');
  await request(app).delete(`/workorders/${row._id}/time-logs/${old._id}`).set(headers()).expect(200);
  const after = await addLabor({ id: String(row._id) }, '2026-12-31');
  expect(after.timeLogs[0]._id).not.toEqual(old._id);
  expect(after.timeLogs[0]).toMatchObject({ laborRate: 200, laborCost: 100, pricing: { sourceRevision: 2 } });
  expect(lookup).toHaveBeenCalledTimes(1); currentEconomics(after);
});
test('#17 concurrent edit cannot overwrite an economic write; one returns safe 409', async () => {
  const row = await correctionFixture(), before = await rawWO(row);
  const original = W.collection.findOneAndUpdate.bind(W.collection);
  let arrived = 0, release;
  const barrier = new Promise(r => { release = r; });
  jest.spyOn(W.collection, 'findOneAndUpdate').mockImplementation(async (...args) => {
    if (++arrived === 2) release(); await barrier; return original(...args);
  });
  const results = await Promise.all([laborPatch(row, { timeSpent: 90 }), laborPatch(row, { timeSpent: 120 })]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  expect(results.find(r => r.status === 409).body).toEqual({ error: 'Work order economics changed; retry' });
  const after = await rawWO(row);
  expect(after.timeLogs[0].laborCost).toBe(engine.amount(after.timeLogs[0].timeSpent, 100, 60));
  expect(after.economics.revision).toBe(before.economics.revision + 1); currentEconomics(after);
});
test('#17 stale description edit cannot overwrite concurrent minute correction', async () => {
  const row = await correctionFixture(), original = W.collection.findOneAndUpdate.bind(W.collection);
  jest.spyOn(W.collection, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
    await mut.updateLabor({ _id: row._id }, String(row.timeLogs[0]._id), { timeSpent: 90 }, admin());
    return original(...args);
  });
  await laborPatch(row, { description: 'Stale correction' }).expect(409);
  const after = await rawWO(row);
  expect(after.timeLogs[0]).toMatchObject({ timeSpent: 90, laborCost: 150, description: '' }); currentEconomics(after);
});
test('#17 ambiguous embedded identities fail without writing', async () => {
  const row = await correctionFixture();
  await W.collection.updateOne({ _id: row._id }, { $push: { timeLogs: row.timeLogs[0] } });
  const before = await rawWO(row);
  await laborPatch(row, { timeSpent: 90 }).expect(409);
  expect(await rawWO(row)).toEqual(before);
});
test.each(['Completed', 'reopened'])('#17 correction on %s retains original authority', async state => {
  const row = await correctionFixture();
  await request(app).patch(`/workorders/${row._id}/status`).set(headers()).send({ status: 'Completed' }).expect(200);
  if (state === 'reopened') await request(app).patch(`/workorders/${row._id}/status`).set(headers()).send({ status: 'Open' }).expect(200);
  const before = await rawWO(row);
  await publishPeriods([ratePeriod('2026-10-01', null, 200)], 1);
  const lookup = jest.spyOn(rates, 'resolve');
  await laborPatch(row, { timeSpent: 90 }).expect(200);
  const after = await rawWO(row);
  expect(after.status).toBe(before.status);
  expect(after.timeLogs[0]).toEqual({ ...before.timeLogs[0], timeSpent: 90, laborCost: 150 });
  expect(lookup).not.toHaveBeenCalled(); currentEconomics(after);
});
