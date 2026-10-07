// Pure aggregation of canonical facts. No date/price/life/recommendation resolution.
const VERSION = 'lifecycle-aggregate-v1';
const ECONOMIC_VERSION = 'wo-cost-v1';
const DAY = 86400000;
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const round = value => Math.round(value * 100) / 100;
const percent = (count, total) => total ? round(count / total * 100) : null;
const mean = values => values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const median = values => {
  const sorted = [...values].sort((a, b) => a - b),
    n = sorted.length;
  return n ? round(n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : null;
};
function maintenanceWindow(asOf) {
  return {
    type: 'rolling',
    durationDays: 365,
    start: new Date(new Date(asOf).getTime() - 365 * DAY).toISOString(),
    end: new Date(asOf).toISOString(),
    startInclusive: true,
    endInclusive: true,
    dateField: 'completionDate',
    statuses: ['Completed']
  };
}
function usable(row, asOf) {
  const a = row.assessment;
  return a?.schemaVersion === 'asset-lifecycle-v2' && a.versions?.lifecycleCalculation === 'asset-lifecycle-v2.0' && a.versions?.lifecyclePolicy === 'approved-lifecycle-2026-10-06' && a.versions?.economicCalculation === ECONOMIC_VERSION && String(a.assetId) === String(row.assetId) && a.asOf === asOf && a.capital && a.serviceAge && a.maintenance && a.replacementAssessment;
}
function moneyAggregate(rows, measure) {
  const missing = [],
    groups = new Map(),
    unidentified = [];
  let valuedAssetCount = 0;
  for (const row of rows) {
    const value = row.assessment?.capital?.[measure];
    if (!value || !['recorded', 'estimated', 'resolved'].includes(value.status) || !finite(value.amount)) {
      missing.push({
        assetId: row.assetId,
        reason: row.reason || (value?.amount === null ? 'value_unknown' : 'invalid_value')
      });
      continue;
    }
    valuedAssetCount++;
    if (typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency)) {
      unidentified.push({
        assetId: row.assetId,
        amount: value.amount
      });
      missing.push({
        assetId: row.assetId,
        reason: 'currency_unknown'
      });
      continue;
    }
    const group = groups.get(value.currency) || {
      currency: value.currency,
      knownSubtotal: 0,
      valuedAssetCount: 0
    };
    group.knownSubtotal += value.amount;
    group.valuedAssetCount++;
    groups.set(value.currency, group);
  }
  const currencyGroups = [...groups.values()].map(group => ({
    ...group,
    knownSubtotal: round(group.knownSubtotal)
  })).sort((a, b) => a.currency.localeCompare(b.currency));
  if (currencyGroups.length > 1) missing.push({
    reason: 'incompatible_currencies'
  });
  // Never add unidentified amounts together or convert currencies. One such amount
  // can be displayed individually, but cannot establish complete currency evidence.
  const knownSubtotal = currencyGroups.length === 1 ? currencyGroups[0].knownSubtotal : currencyGroups.length === 0 && unidentified.length === 1 ? unidentified[0].amount : currencyGroups.length === 0 && unidentified.length === 0 ? 0 : null;
  const isComplete = missing.length === 0;
  return {
    currency: currencyGroups.length === 1 ? currencyGroups[0].currency : null,
    knownSubtotal,
    total: isComplete ? knownSubtotal : null,
    isComplete,
    populationAssetCount: rows.length,
    valuedAssetCount,
    missingAssetCount: rows.length - valuedAssetCount,
    unresolvedAssetCount: new Set(missing.filter(item => item.assetId).map(item => item.assetId)).size,
    currencyUnknownAssetCount: unidentified.length,
    currencyGroups,
    unidentifiedCurrencyValues: unidentified,
    missing
  };
}
function recommendationAggregate(rows) {
  const counts = {
    recommended: 0,
    not_recommended: 0,
    insufficient_data: 0
  };
  let unavailableAssessmentCount = 0;
  for (const row of rows) {
    if (!row.assessment) {
      unavailableAssessmentCount++;
      continue;
    }
    const state = row.assessment.replacementAssessment?.state;
    counts[Object.hasOwn(counts, state) ? state : 'insufficient_data']++;
  }
  const evaluatedCount = counts.recommended + counts.not_recommended;
  return {
    populationAssetCount: rows.length,
    recommendedCount: counts.recommended,
    notRecommendedCount: counts.not_recommended,
    insufficientDataCount: counts.insufficient_data,
    unavailableAssessmentCount,
    insufficientDataIncludingUnavailableCount: counts.insufficient_data + unavailableAssessmentCount,
    evaluatedCount,
    recommendedPercentOfPopulation: percent(counts.recommended, rows.length),
    recommendedPercentOfEvaluated: percent(counts.recommended, evaluatedCount)
  };
}
function ageAggregate(rows) {
  const stateCounts = {
    resolved: 0,
    estimated: 0,
    unknown: 0,
    invalid: 0,
    not_started: 0,
    unavailable: 0
  };
  const buckets = [{
    key: '0-3',
    label: '0–<3 years',
    minInclusive: 0,
    maxExclusive: 3,
    count: 0
  }, {
    key: '3-6',
    label: '3–<6 years',
    minInclusive: 3,
    maxExclusive: 6,
    count: 0
  }, {
    key: '6-9',
    label: '6–<9 years',
    minInclusive: 6,
    maxExclusive: 9,
    count: 0
  }, {
    key: '9+',
    label: '9+ years',
    minInclusive: 9,
    maxExclusive: null,
    count: 0
  }];
  for (const row of rows) {
    if (!row.assessment) {
      stateCounts.unavailable++;
      continue;
    }
    const age = row.assessment.serviceAge;
    const numeric = ['resolved', 'estimated'].includes(age?.status) && finite(age.years);
    const state = numeric ? age.status : ['unknown', 'invalid', 'not_started'].includes(age?.status) ? age.status : 'invalid';
    stateCounts[state]++;
    if (numeric) buckets.find(bucket => age.years >= bucket.minInclusive && (bucket.maxExclusive === null || age.years < bucket.maxExclusive)).count++;
  }
  return {
    populationAssetCount: rows.length,
    stateCounts,
    buckets
  };
}
function windowMatches(actual, expected) {
  return actual && ['start', 'end', 'dateField', 'startInclusive', 'endInclusive'].every(key => actual[key] === expected[key]) && JSON.stringify(actual.statuses) === JSON.stringify(expected.statuses);
}
function maintenanceAggregate(rows, window, scopeName = 'directMaintenance') {
  let knownSubtotal = 0,
    completeAssetCount = 0,
    workOrderCount = 0,
    fullyPricedWorkOrderCount = 0,
    countUnavailableAssetCount = 0;
  const completeValues = [],
    missingComponents = [],
    valuationBases = new Set();
  for (const row of rows) {
    const a = row.assessment,
      scope = a?.maintenance?.last365Days?.[scopeName];
    const shape = scope && finite(scope.knownSubtotal) && Array.isArray(scope.missingComponents) && Array.isArray(scope.valuationBases) && typeof scope.isComplete === 'boolean' && (scope.isComplete ? finite(scope.total) && scope.total === scope.knownSubtotal && scope.missingComponents.length === 0 : scope.total === null && scope.missingComponents.length > 0);
    if (!a || !windowMatches(a.maintenance.window, window) || !shape) {
      missingComponents.push({
        assetId: row.assetId,
        reason: row.reason || (!windowMatches(a?.maintenance?.window, window) ? 'maintenance_window_unavailable_or_mismatch' : 'maintenance_scope_unavailable')
      });
      countUnavailableAssetCount++;
      continue;
    }
    knownSubtotal += scope.knownSubtotal;
    scope.valuationBases.forEach(basis => valuationBases.add(basis));
    if (scope.isComplete) {
      completeAssetCount++;
      completeValues.push(scope.total);
    } else missingComponents.push(...scope.missingComponents.map(item => ({
      ...item,
      assetId: row.assetId
    })));
    if (Number.isInteger(scope.workOrderCount) && scope.workOrderCount >= 0 && Number.isInteger(scope.fullyPricedCount) && scope.fullyPricedCount >= 0 && scope.fullyPricedCount <= scope.workOrderCount) {
      workOrderCount += scope.workOrderCount;
      fullyPricedWorkOrderCount += scope.fullyPricedCount;
    } else countUnavailableAssetCount++;
  }
  const isComplete = completeAssetCount === rows.length;
  return {
    scope: scopeName,
    label: 'Direct Maintenance Cost — Last 365 Days',
    currency: 'USD',
    currencyBasis: ECONOMIC_VERSION,
    knownSubtotal: round(knownSubtotal),
    total: isComplete ? round(knownSubtotal) : null,
    isComplete,
    populationAssetCount: rows.length,
    completeAssetCount,
    incompleteAssetCount: rows.length - completeAssetCount,
    missingComponents,
    valuationBases: [...valuationBases].sort(),
    workOrders: {
      knownCount: workOrderCount,
      knownFullyPricedCount: fullyPricedWorkOrderCount,
      isComplete: countUnavailableAssetCount === 0,
      countUnavailableAssetCount
    },
    statistics: {
      fleetMean: isComplete ? mean(completeValues) : null,
      completeRecordSampleMean: mean(completeValues),
      completeRecordSampleMedian: median(completeValues),
      sampleAssetCount: completeValues.length,
      populationAssetCount: rows.length
    }
  };
}
function aggregateLifecycle(inputRows, {
  asOf
} = {}) {
  const at = new Date(asOf);
  if (!Number.isFinite(at.getTime())) throw new TypeError('Valid aggregation asOf is required');
  const end = at.toISOString();
  if (new Set(inputRows.map(row => String(row.assetId))).size !== inputRows.length) throw new TypeError('Population members must be unique');
  const rows = inputRows.map(row => ({
    ...row,
    assessment: usable(row, end) ? row.assessment : null,
    reason: usable(row, end) ? null : row.reason || 'assessment_invalid_or_unsupported'
  }));
  const assessedAssetCount = rows.filter(row => row.assessment).length,
    window = maintenanceWindow(end);
  return {
    schemaVersion: VERSION,
    asOf: end,
    versions: {
      aggregation: VERSION,
      assetAssessment: 'asset-lifecycle-v2',
      economicCalculation: ECONOMIC_VERSION
    },
    population: {
      populationAssetCount: rows.length,
      assessedAssetCount,
      unavailableAssessmentCount: rows.length - assessedAssetCount,
      unavailable: rows.filter(row => !row.assessment).map(row => ({
        assetId: row.assetId,
        reason: row.reason
      }))
    },
    capital: {
      replacementValue: moneyAggregate(rows, 'replacementValue'),
      estimatedDepreciatedValue: moneyAggregate(rows, 'estimatedDepreciatedValue'),
      accountingBookValue: moneyAggregate(rows, 'accountingBookValue')
    },
    replacementReview: recommendationAggregate(rows),
    age: ageAggregate(rows),
    maintenance: {
      window,
      primaryScope: 'directMaintenance',
      directMaintenance: maintenanceAggregate(rows, window)
    },
    rows
  };
}
module.exports = {
  VERSION,
  aggregateLifecycle,
  moneyAggregate,
  recommendationAggregate,
  ageAggregate,
  maintenanceAggregate,
  maintenanceWindow
};
