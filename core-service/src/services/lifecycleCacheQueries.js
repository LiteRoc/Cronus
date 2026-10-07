const Asset = require('../models/Asset');
const cache = require('./lifecycleCache');
const BOOLEAN = ['replacementRecommended', 'ageExceeded', 'highMaintenance'];
function options(query) {
  for (const key of BOOLEAN) {
    if (query[key] !== undefined && !['true', 'false'].includes(query[key])) throw Object.assign(new Error('Invalid lifecycle filter'), {
      status: 400
    });
  }
  if (query.ccrAboveBenchmark !== undefined && query.ccrAboveBenchmark !== 'false') throw Object.assign(new Error('CCR lifecycle policy is not configured'), {
    status: 400
  });
  if (query.lifecycleCacheState && !['fresh', 'stale', 'missing', 'unsupported'].includes(query.lifecycleCacheState)) throw Object.assign(new Error('Invalid lifecycle cache state'), {
    status: 400
  });
  return BOOLEAN.some(k => query[k] !== undefined) || !!query.lifecycleCacheState;
}
function matches(asset, state, query) {
  if (query.lifecycleCacheState && state.state !== query.lifecycleCacheState) return false;
  if (!BOOLEAN.some(k => query[k] !== undefined)) return true;
  if (state.state !== 'fresh') return false;
  const a = asset.lifecycleCache.assessment;
  if (query.replacementRecommended !== undefined && a.replacementAssessment.state !== (query.replacementRecommended === 'true' ? 'recommended' : 'not_recommended')) return false;
  if (query.ageExceeded !== undefined) {
    const rule = a.replacementAssessment.rules.find(r => r.code === 'adopted_expected_life');
    if (rule?.status !== 'evaluated' || rule.triggered !== (query.ageExceeded === 'true')) return false;
  }
  if (query.highMaintenance !== undefined) {
    const amount = asset.lifecycleCache.materialized?.observedInternalLaborParts;
    if (typeof amount !== 'number' || amount > 0 !== (query.highMaintenance === 'true')) return false;
  }
  return true;
}
function record(coverage, state, asset) {
  coverage.eligiblePopulation++;
  if (state.state === 'fresh') {
    coverage.freshEvaluated++;
    if (asset.lifecycleCache.assessment.replacementAssessment.state === 'insufficient_data') coverage.insufficientData++;
  } else coverage[state.state]++;
}
const initial = () => ({
  ...cache.coverage(),
  insufficientData: 0
});
// Bounded source verification, never live assessment computation in ordinary queries.
async function scan(filter, visit, {
  now = new Date(),
  pageSize = 200
} = {}) {
  let last = null;
  while (true) {
    const query = last ? {
      $and: [filter, {
        _id: {
          $gt: last
        }
      }]
    } : filter;
    const assets = await Asset.find(query).sort({
      _id: 1
    }).limit(pageSize).lean();
    if (!assets.length) break;
    for (const row of await cache.inspectPage(assets, now)) await visit(row);
    last = assets.at(-1)._id;
  }
}
async function filteredPage(filter, query, {
  page,
  limit,
  now = new Date()
}) {
  const coverage = {
      ...initial(),
      verifiedAt: now.toISOString(),
      filterMode: BOOLEAN.some(k => query[k] !== undefined) ? 'canonical_predicate' : 'cache_state'
    },
    selected = [];
  let totalAssets = 0;
  const start = (page - 1) * limit;
  await scan(filter, ({
    asset,
    state
  }) => {
    record(coverage, state, asset);
    if (matches(asset, state, query)) {
      if (totalAssets >= start && selected.length < limit) selected.push({
        ...asset,
        lifecycleCache: cache.compact(asset, state)
      });
      totalAssets++;
    }
  }, {
    now
  });
  coverage.isComplete = coverage.freshEvaluated === coverage.eligiblePopulation;
  return {
    assets: selected,
    totalAssets,
    lifecycleFilterCoverage: coverage,
    lifecycleFilterSemantics: {
      replacementRecommended: 'canonical replacement-review state; false excludes insufficient data',
      ageExceeded: 'adopted_expected_life rule',
      highMaintenance: 'deprecated positive observed internal labor + parts, not a high-cost policy',
      ccrAboveBenchmark: 'not configured',
      insufficientDataExcluded: true
    }
  };
}
async function annotate(assets, now = new Date()) {
  return (await cache.inspectPage(assets, now)).map(({
    asset,
    state
  }) => ({
    ...asset,
    lifecycleCache: cache.compact(asset, state)
  }));
}
async function forecast(filter, {
  now = new Date()
} = {}) {
  const coverage = initial(),
    groups = new Map(),
    unprojected = [];
  let unavailableProjection = 0;
  await scan(filter, ({
    asset,
    state
  }) => {
    record(coverage, state, asset);
    if (state.state !== 'fresh') {
      unprojected.push({ assetId: String(asset._id), assessment: null, reason: 'cache_' + state.state });
      return;
    }
    const a = asset.lifecycleCache.assessment,
      age = a.serviceAge,
      life = a.expectedLife;
    if (typeof age.years !== 'number' || !['resolved', 'estimated'].includes(age.status) || !life.isAdopted || !(life.years > 0) || life.status !== 'resolved') {
      unavailableProjection++;
      unprojected.push({ assetId: String(asset._id), assessment: null, reason: 'projection_evidence_unavailable' });
      return;
    }
    const year = now.getUTCFullYear() + Math.max(0, Math.ceil(life.years - age.years));
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push({
      assetId: String(asset._id),
      assessment: {
        capital: a.capital,
        replacementAssessment: a.replacementAssessment
      },
      asset: {
        _id: String(asset._id),
        ctrlNumber: asset.ctrlNumber,
        manufacturer: asset.manufacturer,
        model: asset.model,
        templateId: asset.templateId
      }
    });
  }, {
    now
  });
  coverage.isComplete = coverage.freshEvaluated === coverage.eligiblePopulation;
  const forecastYears = [...groups].sort((a, b) => a[0] - b[0]).map(([year, rows]) => {
    // Canonical aggregation validates an identical asOf; cached rows legitimately have
    // different evaluation instants, so use the pure capital/review helpers directly.
    const {
      moneyAggregate,
      recommendationAggregate
    } = require('./lifecycleAggregation');
    const capital = moneyAggregate(rows, 'replacementValue');
    return {
      year,
      assetCount: rows.length,
      capital,
      estimatedCapitalNeed: capital.total,
      replacementReview: recommendationAggregate(rows),
      assets: rows.map(row => ({
        ...row.asset,
        estimatedReplacementCost: row.assessment.capital.replacementValue.amount,
        currency: row.assessment.capital.replacementValue.currency,
        replacementAssessmentState: row.assessment.replacementAssessment.state
      }))
    };
  });
  const capital = require('./lifecycleAggregation').moneyAggregate([...groups.values()].flat().concat(unprojected), 'replacementValue');
  const freshForecasted = forecastYears.reduce((sum, y) => sum + y.assetCount, 0);
  return {
    schemaVersion: 'lifecycle-forecast-v2',
    asOf: now.toISOString(),
    forecastYears,
    totalForecastedAssets: freshForecasted,
    totalAssetsEvaluated: coverage.eligiblePopulation,
    totalEstimatedCapitalNeed: capital.total,
    capital,
    lifecycleCoverage: coverage,
    projectionUnavailableCount: unavailableProjection,
    projectionIsComplete: coverage.isComplete && unavailableProjection === 0,
    isComplete: coverage.isComplete && unavailableProjection === 0 && capital.isComplete,
    capitalTotalsDeprecated: 'use independent per-year canonical capital groups; no combined currency assumption',
    projectionMeaning: 'adopted useful-life review horizon, not mandatory replacement',
    population: 'non-deleted, non-archived current Assets; statuses disclosed by query'
  };
}
module.exports = {
  options,
  matches,
  scan,
  filteredPage,
  annotate,
  forecast
};
