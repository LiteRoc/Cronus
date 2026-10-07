import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const require = createRequire(new URL('../../../package.json', import.meta.url)),
  m = require('mongoose'),
  cache = require('./src/services/lifecycleCache'),
  refresh = require('./src/services/lifecycleCacheRefresh');
const fid = '000000000000000000000001',
  other = '000000000000000000000002',
  actor = '000000000000000000000003',
  secret = 'synthetic-cache-8';
let h, app, A, T, F, O, W;
const policy = {
  sourceType: 'asset_override',
  expectedLifeYears: 5,
  reference: 'synthetic',
  approvedBy: new m.Types.ObjectId(actor),
  approvedAt: new Date('2025-01-01')
};
async function seed(extra = {}) {
  const a = {
    _id: new m.Types.ObjectId(),
    facilityId: new m.Types.ObjectId(fid),
    ctrlNumber: 'SYN-8',
    manufacturer: 'Synthetic',
    model: 'Pump',
    status: 'Active',
    serviceStartDate: new Date('2000-01-01'),
    lifecyclePolicy: policy,
    ...extra
  };
  await A.collection.insertOne(a);
  return a;
}
const headers = () => ({
  Authorization: `Bearer ${jwt.sign({
    sub: actor,
    role: 'technician',
    facilityId: fid,
    facilities: [fid]
  }, secret, {
    issuer: 'cronus.api',
    audience: 'cronus.app',
    expiresIn: '10m'
  })}`,
  'x-facility-id': fid
});
const list = (q = '') => request(app).get('/assets' + q).set(headers());
const forecast = () => request(app).get('/dashboard/lifecycle/replacement-forecast').set(headers());
async function materialize(a, extra = {}) {
  return cache.materializePage([await A.findById(a._id).lean()], extra);
}
async function get(a) {
  return A.findById(a._id).lean();
}
jest.setTimeout(120000);
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.CRON_ENABLED = 'false';
  process.env.JWT_SECRET = secret;
  process.env.JWT_ISS = 'cronus.api';
  process.env.JWT_AUD = 'cronus.app';
  m.set('autoIndex', false);
  h = await createIsolatedMongoHarness(m);
  A = require('./src/models/Asset');
  T = require('./src/models/EquipmentTemplate');
  F = require('./src/models/Facility');
  O = require('./src/models/Organization');
  W = require('./src/models/WorkOrder');
  app = express();
  app.use(express.json());
  app.use('/assets', require('./src/routers/assetsRouter'));
  app.use('/dashboard', require('./src/routers/dashboardRouter'));
});
beforeEach(async () => {
  for (const level of ['log', 'error', 'warn']) jest.spyOn(console, level).mockImplementation(() => {});
  await F.collection.insertMany([{
    _id: new m.Types.ObjectId(fid),
    name: 'Synthetic'
  }, {
    _id: new m.Types.ObjectId(other),
    name: 'Foreign'
  }]);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([A, T, F, O, W].map(M => M.deleteMany({})));
});
afterAll(async () => {
  if (h) await h.stop();
});
test('configured Mongo targets fail closed', async () => await expect(m.connect(process.env.MONGO_URI)).rejects.toThrow('not issued'));
test('canonical refresh creates fresh cache without changing source facts or metrics', async () => {
  const a = await seed({
    metrics: {
      projectedAnnualMaintenance: 999,
      replacementRecommended: false
    }
  });
  expect((await materialize(a)).get(String(a._id))).toBe('refreshed');
  const stored = await get(a);
  expect(stored.metrics).toEqual(a.metrics);
  expect(stored.serviceStartDate).toEqual(a.serviceStartDate);
  expect(stored.lifecycleCache.assessment.replacementAssessment.state).toBe('recommended');
  const evidence = (await cache.dependencies([stored])).get(String(a._id));
  expect(cache.freshness(stored, evidence).state).toBe('fresh');
  expect((await materialize(a)).get(String(a._id))).toBe('skipped');
});
test('fresh recommended matches while legacy/stale positive and stale negative excluded', async () => {
  const fresh = await seed(),
    legacy = await seed({
      metrics: {
        replacementRecommended: true,
        projectedAnnualMaintenance: 999
      }
    }),
    negative = await seed({
      metrics: {
        replacementRecommended: false
      }
    });
  await materialize(fresh);
  const r = (await list('?replacementRecommended=true').expect(200)).body;
  expect(r.assets.map(a => a._id)).toEqual([String(fresh._id)]);
  expect(r.lifecycleFilterCoverage).toMatchObject({
    eligiblePopulation: 3,
    freshEvaluated: 1,
    stale: 2,
    isComplete: false
  });
  const n = (await list('?replacementRecommended=false').expect(200)).body;
  expect(n.assets).toHaveLength(0);
  expect(n.lifecycleFilterCoverage.stale).toBe(2);
});
test('fresh insufficient-data cache excluded from positive and negative review filters', async () => {
  const a = await seed({
    lifecyclePolicy: null,
    serviceStartDate: null
  });
  await materialize(a);
  for (const v of ['true', 'false']) {
    const r = (await list('?replacementRecommended=' + v).expect(200)).body;
    expect(r.assets).toHaveLength(0);
    expect(r.lifecycleFilterCoverage.insufficientData).toBe(1);
  }
});
test('coverage includes missing unsupported expired and fresh without source mutation', async () => {
  const fresh = await seed(),
    missing = await seed(),
    unsupported = await seed(),
    expired = await seed();
  await materialize(fresh);
  await materialize(unsupported);
  await materialize(expired);
  await A.collection.updateOne({
    _id: unsupported._id
  }, {
    $set: {
      'lifecycleCache.policyVersion': 'obsolete'
    }
  });
  await A.collection.updateOne({
    _id: expired._id
  }, {
    $set: {
      'lifecycleCache.validUntil': new Date(0).toISOString()
    }
  });
  const r = (await list('?replacementRecommended=true').expect(200)).body;
  expect(r.lifecycleFilterCoverage).toMatchObject({
    eligiblePopulation: 4,
    freshEvaluated: 1,
    missing: 1,
    unsupported: 1,
    stale: 1,
    isComplete: false
  });
});
test('zero fresh coverage is disclosed, not complete zero-result certainty', async () => {
  await seed({
    metrics: {
      replacementRecommended: true
    }
  });
  const r = (await list('?replacementRecommended=true').expect(200)).body;
  expect(r.totalAssets).toBe(0);
  expect(r.lifecycleFilterCoverage).toMatchObject({
    eligiblePopulation: 1,
    freshEvaluated: 0,
    isComplete: false
  });
});
test('live assessment remains authoritative and read-only with legacy cache', async () => {
  const a = await seed({
    metrics: {
      replacementRecommended: false
    }
  });
  const before = JSON.stringify(await get(a));
  const r = (await request(app).get(`/assets/${a._id}/lifecycle`).set(headers()).expect(200)).body;
  expect(r.assessment.replacementAssessment.state).toBe('recommended');
  expect(JSON.stringify(await get(a))).toBe(before);
});
test('ordinary list returns compact freshness metadata, not full cached assessment', async () => {
  const a = await seed();
  await materialize(a);
  const r = (await list().expect(200)).body;
  expect(r.assets[0].lifecycleCache.state).toBe('fresh');
  expect(r.assets[0].lifecycleCache.assessment).toBeUndefined();
});
test('cache-state query can explicitly find missing materializations', async () => {
  await seed();
  const r = (await list('?lifecycleCacheState=missing').expect(200)).body;
  expect(r.totalAssets).toBe(1);
  expect(r.assets[0].lifecycleCache.state).toBe('missing');
});
test('Asset edit marks cache stale without recomputation', async () => {
  const a = await seed();
  await materialize(a);
  const doc = await A.findById(a._id);
  doc.serviceStartDate = new Date();
  await doc.save();
  const r = (await list('?replacementRecommended=true').expect(200)).body;
  expect(r.totalAssets).toBe(0);
  expect(r.lifecycleFilterCoverage.stale).toBe(1);
});
test('direct Asset source edit detected even without dirty marking', async () => {
  const a = await seed();
  await materialize(a);
  await A.collection.updateOne({
    _id: a._id
  }, {
    $set: {
      serviceStartDate: new Date()
    }
  });
  expect((await list('?replacementRecommended=true').expect(200)).body.lifecycleFilterCoverage.stale).toBe(1);
});
test('Template evidence change detected without cache update', async () => {
  const t = await T.create({
    manufacturer: 'Synthetic',
    model: 'Pump',
    benchmark: {
      averageQuotedPrice: 100000
    }
  });
  const a = await seed({
    templateId: t._id
  });
  await materialize(a);
  await T.collection.updateOne({
    _id: t._id
  }, {
    $set: {
      'benchmark.averageQuotedPrice': 200000
    }
  });
  expect((await list('?replacementRecommended=true').expect(200)).body.lifecycleFilterCoverage.stale).toBe(1);
});
test('WorkOrder economic completion/deletion inputs invalidate fingerprint', async () => {
  const a = await seed();
  await materialize(a);
  const w = {
    _id: new m.Types.ObjectId(),
    assetId: a._id,
    facilityId: new m.Types.ObjectId(fid),
    status: 'Completed',
    completionDate: new Date(),
    economics: {
      schemaVersion: 1,
      revision: 1
    },
    timeLogs: [],
    partsUsed: [],
    travelLogs: []
  };
  await W.collection.insertOne(w);
  expect((await list('?replacementRecommended=true').expect(200)).body.lifecycleFilterCoverage.stale).toBe(1);
  await materialize(a);
  await W.collection.updateOne({
    _id: w._id
  }, {
    $set: {
      'economics.revision': 2,
      status: 'Open'
    }
  });
  expect((await list('?replacementRecommended=true').expect(200)).body.lifecycleFilterCoverage.stale).toBe(1);
  await materialize(a);
  await W.collection.updateOne({
    _id: w._id
  }, {
    $set: {
      deletedAt: new Date()
    }
  });
  expect((await list('?replacementRecommended=true').expect(200)).body.lifecycleFilterCoverage.stale).toBe(1);
});
test('older calculation cannot overwrite source change during calculation', async () => {
  const a = await seed();
  const outcomes = await materialize(a, {
    beforePersist: () => A.collection.updateOne({
      _id: a._id
    }, {
      $set: {
        purchaseCost: 50
      }
    })
  });
  expect(outcomes.get(String(a._id))).toBe('conflict');
  expect((await get(a)).lifecycleCache).toBeUndefined();
});
test('older calculation cannot overwrite newer envelope', async () => {
  const a = await seed();
  const outcomes = await materialize(a, {
    beforePersist: () => A.collection.updateOne({
      _id: a._id
    }, {
      $set: {
        lifecycleCache: {
          schemaVersion: 'newer-run',
          calculatedAt: new Date()
        }
      }
    })
  });
  expect(outcomes.get(String(a._id))).toBe('conflict');
  expect((await get(a)).lifecycleCache.schemaVersion).toBe('newer-run');
});
test('canonical forecast excludes stale population and reports unknown evidence separately', async () => {
  const a = await seed(),
    unknown = await seed({
      serviceStartDate: null
    }),
    stale = await seed({
      metrics: {
        yearsInService: 0
      }
    });
  await materialize(a);
  await materialize(unknown);
  const r = (await forecast().expect(200)).body;
  expect(r).toMatchObject({
    schemaVersion: 'lifecycle-forecast-v2',
    totalAssetsEvaluated: 3,
    totalForecastedAssets: 1,
    projectionUnavailableCount: 1,
    isComplete: false,
    lifecycleCoverage: {
      freshEvaluated: 2,
      stale: 1
    }
  });
  expect(r.forecastYears[0].assets.map(a => a._id)).toEqual([String(a._id)]);
  expect(r.totalEstimatedCapitalNeed).toBeNull();
});
test('all fresh adopted ages have complete projection coverage, capital remains independently unknown', async () => {
  const a = await seed();
  await materialize(a);
  const r = (await forecast().expect(200)).body;
  expect(r.projectionIsComplete).toBe(true);
  expect(r.lifecycleCoverage.isComplete).toBe(true);
  expect(r.capital.isComplete).toBe(false);
});
test('Facility isolation preserved for filter coverage and forecast', async () => {
  await seed({
    facilityId: new m.Types.ObjectId(other)
  });
  expect((await list('?replacementRecommended=true').expect(200)).body.lifecycleFilterCoverage.eligiblePopulation).toBe(0);
  expect((await forecast().expect(200)).body.totalAssetsEvaluated).toBe(0);
});
test('unauthenticated filters and forecast denied', async () => {
  await request(app).get('/assets?replacementRecommended=true').expect(401);
  await request(app).get('/dashboard/lifecycle/replacement-forecast').expect(401);
});
for (const q of ['replacementRecommended=bad', 'lifecycleCacheState=bad', 'ccrAboveBenchmark=true']) test(`invalid/unconfigured filter ${q} rejected explicitly`, async () => await list('?' + q).expect(400));
test('legacy maintenance 999 cannot drive current highMaintenance filter', async () => {
  const a = await seed({
    metrics: {
      projectedAnnualMaintenance: 999
    }
  });
  await materialize(a);
  const r = (await list('?highMaintenance=true').expect(200)).body;
  expect(r.assets).toHaveLength(0);
  expect(r.lifecycleFilterSemantics.highMaintenance).toMatch(/deprecated/);
});
test('bounded refresh, resume, unsupported recovery and fresh skip', async () => {
  for (let i = 0; i < 5; i++) await seed();
  const r = await refresh.refreshLifecycleCaches({
    pageSize: 2,
    maxAssets: 3
  });
  expect(r).toMatchObject({
    processed: 3,
    refreshed: 3,
    hasMore: true
  });
  const next = await refresh.refreshLifecycleCaches({
    pageSize: 2,
    afterId: r.nextCursor
  });
  expect(next.refreshed).toBe(2);
  expect(next.nextCursor).toBeNull();
  const repeat = await refresh.refreshLifecycleCaches({
    pageSize: 2
  });
  expect(repeat).toMatchObject({
    skipped: 5,
    refreshed: 0
  });
});
test('empty refresh safe', async () => expect(await refresh.refreshLifecycleCaches()).toMatchObject({
  processed: 0,
  nextCursor: null
}));
test('same-process overlap skips while first run owns lock', async () => {
  await seed();
  let release, entered;
  const start = new Promise(r => entered = r),
    gate = new Promise(r => release = r);
  const first = refresh.refreshLifecycleCaches({
    beforePersist: async () => {
      entered();
      await gate;
    }
  });
  await start;
  expect(await refresh.refreshLifecycleCaches()).toMatchObject({
    state: 'overlap_skipped',
    processed: 0
  });
  release();
  expect((await first).refreshed).toBe(1);
});
test('page failure counted and later pages continue; retry succeeds', async () => {
  await seed();
  await seed();
  jest.spyOn(cache, 'materializePage').mockRejectedValueOnce(new Error('synthetic failed page'));
  const r = await refresh.refreshLifecycleCaches({
    pageSize: 1
  });
  expect(r).toMatchObject({
    failed: 1,
    refreshed: 1,
    processed: 2
  });
  expect((await refresh.refreshLifecycleCaches()).refreshed).toBe(1);
});
test('missing/deleted Template and malformed legacy references do not crash refresh', async () => {
  await seed({
    templateId: new m.Types.ObjectId()
  });
  await seed({
    templateId: 'malformed'
  });
  const r = await refresh.refreshLifecycleCaches();
  expect(r.processed).toBe(2);
  expect(r.refreshed + r.failed).toBe(2);
});
test('source/template/policy corruption of cached assessment never remains fresh', async () => {
  const a = await seed();
  await materialize(a);
  await A.collection.updateOne({
    _id: a._id
  }, {
    $set: {
      'lifecycleCache.assessment.replacementAssessment.state': 'not_recommended'
    }
  });
  expect((await list('?replacementRecommended=false').expect(200)).body.lifecycleFilterCoverage.unsupported).toBe(1);
});
test('missing stale unsupported and expired recover; fresh skipped', async () => {
  const a = await seed(),
    b = await seed(),
    c = await seed(),
    d = await seed();
  for (const row of [a, b, c]) await materialize(row);
  await A.collection.updateOne({
    _id: b._id
  }, {
    $set: {
      'lifecycleCache.schemaVersion': 'old'
    }
  });
  await A.collection.updateOne({
    _id: c._id
  }, {
    $set: {
      'lifecycleCache.validUntil': '2000-01-01'
    }
  });
  const r = await refresh.refreshLifecycleCaches({
    pageSize: 2
  });
  expect(r).toMatchObject({
    processed: 4,
    refreshed: 3,
    skipped: 1,
    failed: 0
  });
});
test('rolling completion expiry is captured in validity metadata', async () => {
  const a = await seed();
  const date = new Date(Date.now() - 365 * 86400000 + 30000);
  await W.collection.insertOne({
    _id: new m.Types.ObjectId(),
    assetId: a._id,
    facilityId: new m.Types.ObjectId(fid),
    status: 'Completed',
    completionDate: date,
    economics: {
      schemaVersion: 1,
      revision: 1
    },
    timeLogs: [],
    partsUsed: [],
    travelLogs: []
  });
  await materialize(a);
  const c = (await get(a)).lifecycleCache;
  expect(Date.parse(c.validUntil)).toBe(date.getTime() + 365 * 86400000 + 1);
});
test('scheduler module executes templated Asset with registration disabled', async () => {
  const cron = require('node-cron'),
    schedule = jest.spyOn(cron, 'schedule').mockImplementation(() => {
      throw new Error('Registration forbidden');
    });
  const t = await T.create({
    manufacturer: 'Synthetic',
    model: 'Pump'
  });
  await seed({
    templateId: t._id
  });
  const scheduler = require('./src/cronJobs/lifecycleScheduler');
  expect(schedule).not.toHaveBeenCalled();
  expect((await scheduler.scheduledRefresh()).refreshed).toBe(1);
});
test('invalid bounded refresh options rejected', async () => {
  await expect(refresh.refreshLifecycleCaches({
    pageSize: 0
  })).rejects.toThrow('Invalid');
  await expect(refresh.refreshLifecycleCaches({
    afterId: 'bad'
  })).rejects.toThrow('Invalid');
});
test('aged life bucket is not driven by unadopted benchmark-only life', async () => {
  const t = await T.create({
    manufacturer: 'Synthetic',
    model: 'Pump',
    benchmark: {
      expectedUsefulLifeYears: 5
    }
  });
  const a = await seed({
    templateId: t._id,
    lifecyclePolicy: null
  });
  await materialize(a);
  const r = (await forecast().expect(200)).body;
  expect(r.totalForecastedAssets).toBe(0);
  expect(r.projectionUnavailableCount).toBe(1);
});
test('partial cache write failure continues subsequent Asset safely', async () => {
  const a = await seed(),
    b = await seed();
  jest.spyOn(A.collection, 'updateOne').mockImplementationOnce(async () => {
    throw new Error('synthetic failed cache write');
  });
  const results = await cache.materializePage([await get(a), await get(b)]);
  expect(results.get(String(a._id))).toBe('failed');
  expect(results.get(String(b._id))).toBe('refreshed');
});
test('refresh refuses missing Facility context without changing source facts', async () => {
  const a = await seed({
    facilityId: new m.Types.ObjectId()
  });
  const r = await refresh.refreshLifecycleCaches();
  expect(r.failed).toBe(1);
  expect((await get(a)).lifecycleCache).toBeUndefined();
});
test('pagination is bounded and coverage remains fleet-wide', async () => {
  for (let i = 0; i < 3; i++) await seed();
  await refresh.refreshLifecycleCaches();
  const r = (await list('?replacementRecommended=true&page=2&limit=1').expect(200)).body;
  expect(r.assets).toHaveLength(1);
  expect(r.totalAssets).toBe(3);
  expect(r.lifecycleFilterCoverage.eligiblePopulation).toBe(3);
});
test('empty/unknown forecast capital remains incomplete rather than complete zero',async()=>{await seed({metrics:{yearsInService:0}});const r=(await forecast().expect(200)).body;expect(r.capital).toMatchObject({populationAssetCount:1,knownSubtotal:0,total:null,isComplete:false});expect(r.totalEstimatedCapitalNeed).toBeNull();});
