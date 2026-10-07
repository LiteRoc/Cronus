// Derived only: reads verify current source projections; no price/rate resolution here.
const crypto = require('crypto');
const Asset = require('../models/Asset');
const Template = require('../models/EquipmentTemplate');
const Facility = require('../models/Facility');
const Organization = require('../models/Organization');
const WorkOrder = require('../models/WorkOrder');
const {
  assessAssets
} = require('./assetLifecycleAssessmentBatch');
const {
  POLICY_VERSION
} = require('./assetLifecycleAssessment');
const SCHEMA = 'asset-lifecycle-cache-v1',
  CALCULATION = 'asset-lifecycle-v2.0',
  ECONOMICS = 'wo-cost-v1';
const ASSET_FIELDS = ['_id', 'facilityId', 'templateId', 'serviceStartDate', 'installationDate', 'acquisitionDate', 'purchaseDate', 'purchase', 'purchaseCost', 'lifecyclePolicy', 'status', 'isArchived', 'deletedAt', 'lifecycleSourceRevision'];
const TEMPLATE_FIELDS = ['_id', 'benchmark', 'lifecycleDefaults', 'eolYears'];
function stable(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (value._bsontype === 'ObjectId') return String(value);
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
const digest = value => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const project = (object, keys) => Object.fromEntries(keys.filter(k => object?.[k] !== undefined).map(k => [k, object[k]]));
const id = value => value ? String(value._id ?? value) : null;
const validId = value => /^[a-f\d]{24}$/i.test(String(value ?? ''));
async function dependencies(assets, {
  asOf = new Date()
} = {}) {
  const templateIds = [...new Set(assets.map(a => id(a.templateId)).filter(validId))],
    facilityIds = [...new Set(assets.map(a => id(a.facilityId)).filter(validId))];
  const templates = await Template.find({
    _id: {
      $in: templateIds
    }
  }).select(TEMPLATE_FIELDS.join(' ')).lean();
  const facilities = await Facility.find({
    _id: {
      $in: facilityIds
    }
  }).select('organizationId').lean();
  const organizationIds = [...new Set(facilities.map(f => id(f.organizationId)).filter(validId))];
  const organizations = await Organization.find({
    _id: {
      $in: organizationIds
    }
  }).select('lifecyclePolicies').lean();
  const tMap = new Map(templates.map(t => [id(t), t])),
    fMap = new Map(facilities.map(f => [id(f), f])),
    oMap = new Map(organizations.map(o => [id(o), o]));
  const transitions = new Map(),
    evaluationTime = new Date(asOf).getTime();
  const hashes = new Map(assets.map(a => [id(a), crypto.createHash('sha256')]));
  // Cursor keeps economic dependency evidence bounded; no cost calculation or current pricing.
  const cursor = WorkOrder.find(assets.length ? {
    $or: assets.map(a => ({
      assetId: a._id,
      ...(a.facilityId ? {
        facilityId: a.facilityId
      } : {})
    }))
  } : {
    assetId: {
      $in: []
    }
  }).select('_id assetId facilityId status completionDate deletedAt economics timeLogs travelLogs partsUsed vendorService costs.calculationVersion').sort({
    _id: 1
  }).lean().cursor({ batchSize: 200 });
  for await (const workOrder of cursor) {
    const key = id(workOrder.assetId);
    hashes.get(key)?.update(JSON.stringify(stable(workOrder)) + '\n');
    if (workOrder.status === 'Completed' && !workOrder.deletedAt && workOrder.completionDate) {
      const time = new Date(workOrder.completionDate).getTime();
      if (Number.isFinite(time)) {
        const transition = time > evaluationTime ? time : time + 365 * 86400000 + 1;
        if (transition > evaluationTime) transitions.set(key, Math.min(transitions.get(key) ?? Infinity, transition));
      }
    }
  }
  const result = new Map();
  for (const asset of assets) {
    const template = tMap.get(id(asset.templateId)) ?? null,
      facility = fMap.get(id(asset.facilityId));
    const organization = oMap.get(id(facility?.organizationId));
    const policies = (organization?.lifecyclePolicies ?? []).filter(p => id(p.templateId) === id(asset.templateId));
    const raw = {
      asset: {
        ...project(asset, ASSET_FIELDS),
        templateId: id(asset.templateId)
      },
      template,
      organizationId: id(facility?.organizationId),
      facilityExists: !!facility,
      policies,
      maintenanceFingerprint: hashes.get(id(asset)).digest('hex')
    };
    result.set(id(asset), {
      sourceFingerprint: digest(raw),
      contextValid: !!facility,
      asset: {
        ...asset,
        templateId: template
      },
      dependencies: {
        templateId: id(asset.templateId),
        organizationId: id(facility?.organizationId),
        maintenanceFingerprint: raw.maintenanceFingerprint,
        nextMaintenanceTransition: transitions.has(id(asset)) ? new Date(transitions.get(id(asset))).toISOString() : null
      }
    });
  }
  return result;
}
function freshness(asset, evidence, now = new Date()) {
  const c = asset.lifecycleCache;
  if (!c) return {
    state: Object.keys(asset.metrics ?? {}).length ? 'stale' : 'missing',
    reason: Object.keys(asset.metrics ?? {}).length ? 'legacy_metrics' : 'cache_missing'
  };
  if (c.schemaVersion !== SCHEMA || c.calculationVersion !== CALCULATION || c.policyVersion !== POLICY_VERSION || c.economicCalculationVersion !== ECONOMICS) return {
    state: 'unsupported',
    reason: 'version_unsupported'
  };
  if (!c.assessmentFingerprint || c.assessmentFingerprint !== digest({
    assessment: c.assessment,
    materialized: c.materialized
  }) || !c.assessment?.serviceAge || !c.assessment?.expectedLife || !c.assessment?.capital || !Array.isArray(c.assessment?.replacementAssessment?.rules) || !['recommended', 'not_recommended', 'insufficient_data'].includes(c.assessment.replacementAssessment.state) || c.assessment.schemaVersion !== 'asset-lifecycle-v2' || c.assessment.assetId !== id(asset) || c.assessment.asOf !== c.assessmentAsOf || c.assessment.versions?.lifecycleCalculation !== CALCULATION || c.assessment.versions?.lifecyclePolicy !== POLICY_VERSION || c.assessment.versions?.economicCalculation !== ECONOMICS) return {
    state: 'unsupported',
    reason: 'assessment_unsupported'
  };
  if (evidence?.contextValid === false) return {
    state: 'stale',
    reason: 'facility_context_unavailable'
  };
  const at = Date.parse(c.assessmentAsOf),
    calculated = Date.parse(c.calculatedAt),
    until = Date.parse(c.validUntil),
    time = new Date(now).getTime();
  if (!Number.isFinite(at) || !Number.isFinite(calculated) || !Number.isFinite(until) || at > time || calculated > time || until <= at || until <= calculated || until <= time || !c.sourceFingerprint || c.invalidatedAt || c.sourceFingerprint !== evidence?.sourceFingerprint) return {
    state: 'stale',
    reason: c.invalidatedAt ? 'invalidated' : until <= time ? 'expired' : 'source_or_metadata_changed'
  };
  return {
    state: 'fresh',
    reason: null
  };
}
function expiry(assessment, evidence) {
  const start = new Date(assessment.asOf).getTime();
  let end = start + 60 * 60 * 1000;
  const age = assessment.serviceAge,
    life = assessment.expectedLife;
  if (age.status === 'not_started' && age.startDate) end = Math.min(end, Date.parse(age.startDate));
  if (typeof age.years === 'number' && life.isAdopted && life.years > age.years) end = Math.min(end, start + (life.years - age.years) * 365.25 * 86400000);
  if (evidence?.dependencies.nextMaintenanceTransition) end = Math.min(end, Date.parse(evidence.dependencies.nextMaintenanceTransition));
  if (typeof age.years === 'number' && life.isAdopted && life.years > age.years) {
    const remaining = life.years - age.years;
    end = Math.min(end, start + (remaining - (Math.ceil(remaining) - 1)) * 365.25 * 86400000);
  }
  return new Date(end).toISOString(); // Conservative one-hour rolling-window/age validity, or earlier transition.
}
function envelope(row, evidence, calculatedAt = new Date()) {
  const a = row.assessment;
  if (!a) throw new Error('Canonical assessment unavailable');
  return {
    schemaVersion: SCHEMA,
    calculationVersion: CALCULATION,
    policyVersion: POLICY_VERSION,
    economicCalculationVersion: ECONOMICS,
    assessmentAsOf: a.asOf,
    calculatedAt: new Date(calculatedAt).toISOString(),
    validUntil: expiry(a, evidence),
    sourceFingerprint: evidence.sourceFingerprint,
    dependencies: evidence.dependencies,
    assessment: a,
    materialized: {
      observedInternalLaborParts: row.metrics.projectedAnnualMaintenance
    },
    assessmentFingerprint: digest({
      assessment: a,
      materialized: {
        observedInternalLaborParts: row.metrics.projectedAnnualMaintenance
      }
    }),
    invalidatedAt: null
  };
}
async function markStale(assetIds, {
  session
} = {}) {
  if (!assetIds?.length) return;
  await Asset.collection.updateMany({
    _id: {
      $in: assetIds.filter(validId).map(v => new (require('mongoose').Types.ObjectId)(String(v)))
    }
  }, {
    $inc: {
      lifecycleSourceRevision: 1
    }
  }, session ? {
    session
  } : {});
}
async function materializePage(assets, {
  asOf = new Date(),
  beforePersist
} = {}) {
  const evidence = await dependencies(assets, {
      asOf
    }),
    eligible = assets.filter(a => freshness(a, evidence.get(id(a)), asOf).state !== 'fresh' && evidence.get(id(a)).contextValid);
  const outcomes = new Map(assets.filter(a => !eligible.includes(a)).map(a => [id(a), evidence.get(id(a)).contextValid ? 'skipped' : 'failed']));
  if (!eligible.length) return outcomes;
  const rows = await assessAssets(eligible.map(a => evidence.get(id(a)).asset), {
    asOf
  });
  if (beforePersist) await beforePersist(); // Injection for isolated race verification; not exposed through HTTP.
  const current = eligible.length ? await Asset.find({
    _id: {
      $in: eligible.map(a => a._id)
    }
  }).lean() : [];
  const after = await dependencies(current),
    currentMap = new Map(current.map(a => [id(a), a]));
  for (const asset of eligible) {
    const key = id(asset),
      row = rows.get(key),
      latest = currentMap.get(key);
    if (!row?.assessment) {
      outcomes.set(key, 'failed');
      continue;
    }
    if (!latest || latest.deletedAt || latest.isArchived || evidence.get(key).sourceFingerprint !== after.get(key)?.sourceFingerprint) {
      outcomes.set(key, 'conflict');
      continue;
    }
    const cache = envelope(row, evidence.get(key));
    if (Date.parse(cache.validUntil) <= Date.parse(cache.calculatedAt)) {
      outcomes.set(key, 'expired');
      continue;
    }
    const predicate = {
      _id: asset._id,
      facilityId: asset.facilityId,
      deletedAt: null,
      isArchived: {
        $ne: true
      },
      lifecycleCache: asset.lifecycleCache ?? {
        $exists: false
      },
      lifecycleSourceRevision: asset.lifecycleSourceRevision ?? {
        $exists: false
      }
    };
    // Asset projection plus old-envelope CAS prevents concurrent input edits/newer refresh overwrites.
    for (const field of ASSET_FIELDS.filter(f => !['_id', 'facilityId', 'lifecycleSourceRevision'].includes(f))) predicate[field] = asset[field] === undefined ? {
      $exists: false
    } : asset[field];
    try {
      const update = await Asset.collection.updateOne(predicate, {
        $set: {
          lifecycleCache: cache
        }
      });
      outcomes.set(key, update.matchedCount ? 'refreshed' : 'conflict');
    } catch (_) {
      outcomes.set(key, 'failed');
    }
  }
  return outcomes;
}
function coverage() {
  return {
    eligiblePopulation: 0,
    freshEvaluated: 0,
    stale: 0,
    missing: 0,
    unsupported: 0,
    isComplete: false
  };
}
function compact(asset, state) {
  const c = asset.lifecycleCache;
  return {
    ...state,
    schemaVersion: c?.schemaVersion ?? null,
    calculatedAt: c?.calculatedAt ?? null,
    assessmentAsOf: c?.assessmentAsOf ?? null,
    validUntil: c?.validUntil ?? null,
    replacementAssessmentState: state.state === 'fresh' ? c.assessment.replacementAssessment.state : null
  };
}
async function inspectPage(assets, now = new Date()) {
  const evidence = await dependencies(assets);
  return assets.map(asset => ({
    asset,
    state: freshness(asset, evidence.get(id(asset)), now),
    evidence: evidence.get(id(asset))
  }));
}
module.exports = {
  SCHEMA,
  CALCULATION,
  ECONOMICS,
  dependencies,
  freshness,
  expiry,
  envelope,
  markStale,
  materializePage,
  coverage,
  compact,
  inspectPage,
  digest
};
