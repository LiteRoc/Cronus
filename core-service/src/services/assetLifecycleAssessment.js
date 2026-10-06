// Pure, core-owned live assessment. Legacy fleet/cache calculations remain separate.
const SCHEMA_VERSION = 'asset-lifecycle-v2';
const CALCULATION_VERSION = 'asset-lifecycle-v2.0';
const POLICY_VERSION = 'approved-lifecycle-2026-10-06';
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const present = value => value !== undefined && value !== null && value !== '';
const money = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12;
const life = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const round = value => Math.round(value * 100) / 100;
const currency = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : null;
function date(value) {
  if (!present(value) || !(value instanceof Date || typeof value === 'string')) return null;
  if (typeof value === 'string') {
    const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T.*(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value);
    if (!parts) return null;
    const calendar = new Date(Date.UTC(Number(parts[1]), Number(parts[2])-1, Number(parts[3])));
    if (calendar.getUTCFullYear() !== Number(parts[1]) || calendar.getUTCMonth()+1 !== Number(parts[2]) || calendar.getUTCDate() !== Number(parts[3])) return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}
function resolveServiceAge(asset, asOf, quality) {
  const candidates = [
    ['serviceStartDate', asset.serviceStartDate, 'service_start', false],
    ['installationDate', asset.installationDate, 'installation', false],
    ['acquisitionDate', asset.acquisitionDate, 'acquisition_proxy', true],
    ['purchase.date', asset.purchase?.date, 'purchase_proxy', true],
    ['purchaseDate', asset.purchaseDate, 'purchase_proxy', true],
  ];
  const found = candidates.find(([, value]) => present(value));
  if (!found) {
    quality.missingFields.push('service_start');
    return { startDate: null, years: null, status: 'unknown', source: null, isProxy: false };
  }
  const [field, value, type, isProxy] = found;
  const start = date(value);
  const source = { type, field };
  if (isProxy) quality.assumptions.push('proxy_service_start');
  if (!start) {
    quality.conflicts.push('invalid_service_date');
    return { startDate: null, years: null, status: 'invalid', source, isProxy };
  }
  if (start > asOf) return { startDate: start.toISOString(), years: null, status: 'not_started', source, isProxy };
  // Do not round before rule evaluation: age just below a threshold stays below it.
  return { startDate: start.toISOString(), years: (asOf - start) / YEAR_MS, status: isProxy ? 'estimated' : 'resolved', source, isProxy };
}
function approved(policy) {
  return policy && typeof policy.reference === 'string' && policy.reference.trim() &&
    /^[a-f\d]{24}$/i.test(String(policy.approvedBy ?? '')) && date(policy.approvedAt);
}
function resolveExpectedLife(asset, template, organizationPolicy, quality, asOf) {
  const local = asset.lifecyclePolicy;
  const applicable = policy => !policy?.templateId || String(policy.templateId) === String(template?._id ?? asset.templateId ?? '');
  if (organizationPolicy?.ambiguous && !(approved(local) && local.sourceType !== 'adopted_benchmark' && applicable(local) && date(local.approvedAt) <= asOf)) {
    quality.conflicts.push('ambiguous_organization_lifecycle_policy');
    return { years: null, status: 'invalid', isAdopted: false, source: {type:'organization_policy',adoptionStatus:'ambiguous'} };
  }
  const selected = [
    ['asset_override', local?.sourceType !== 'adopted_benchmark' ? local : null],
    ['organization_policy', organizationPolicy],
    ['adopted_benchmark', local?.sourceType === 'adopted_benchmark' ? local : null],
  ].find(([type, policy]) => approved(policy) && policy.sourceType === type && date(policy.approvedAt) <= asOf && applicable(policy));
  if (selected) {
    const [type, policy] = selected;
    const source = { type: policy.sourceType || type, reference: policy.reference, adoptionStatus: 'approved', approvedAt: date(policy.approvedAt).toISOString(), approvedBy: String(policy.approvedBy) };
    if (policy.ageRuleEnabled === false) return { years: null, status: 'disabled', isAdopted: true, source };
    if (!life(policy.expectedLifeYears)) {
      quality.conflicts.push('invalid_expected_life');
      return { years: null, status: 'invalid', isAdopted: true, source };
    }
    return { years: policy.expectedLifeYears, status: 'resolved', isAdopted: true, source };
  }
  if (local || organizationPolicy) quality.conflicts.push('unapproved_or_inapplicable_lifecycle_policy');
  const raw = [
    ['asset.purchase.expectedLifeYears', asset.purchase?.expectedLifeYears, 'legacy_asset'],
    ['template.lifecycleDefaults.expectedLifeYears', template?.lifecycleDefaults?.expectedLifeYears, 'legacy_template_default'],
    ['template.eolYears', template?.eolYears, 'legacy_template'],
    ['template.benchmark.expectedUsefulLifeYears', template?.benchmark?.expectedUsefulLifeYears, 'external_reference'],
  ].find(([, value]) => present(value));
  if (!raw) {
    quality.missingFields.push('expected_life');
    return { years: null, status: 'unknown', isAdopted: false, source: null };
  }
  const [field, value, type] = raw;
  const source = { type, field, reference: type === 'external_reference' ? template?.benchmark?.source || null : null, adoptionStatus: type === 'external_reference' ? 'reference_only' : 'provisional' };
  if (!life(value)) {
    quality.conflicts.push('invalid_expected_life');
    return { years: null, status: 'invalid', isAdopted: false, source };
  }
  if (type === 'external_reference') {
    quality.missingFields.push('adopted_expected_life');
    return { years: null, referenceYears: value, status: 'reference_only', isAdopted: false, source };
  }
  quality.assumptions.push('provisional_legacy_expected_life');
  return { years: value, status: 'provisional', isAdopted: false, source };
}
function acquisition(asset, quality) {
  const structured = present(asset.purchase?.price);
  const value = structured ? asset.purchase.price : asset.purchaseCost;
  if (!present(value)) {
    quality.missingFields.push('acquisition_basis');
    return { amount: null, currency: null, status: 'unknown', source: null };
  }
  if (!money(value)) {
    quality.conflicts.push('invalid_acquisition_basis');
    return { amount: null, currency: null, status: 'invalid', source: { type: structured ? 'asset_purchase' : 'legacy_purchase_cost' } };
  }
  const unit = structured ? currency(asset.purchase.currency) : null;
  if (!unit) quality.missingFields.push('acquisition_currency');
  return { amount: value, currency: unit, status: 'recorded', source: { type: structured ? 'asset_purchase' : 'legacy_purchase_cost', field: structured ? 'purchase.price' : 'purchaseCost', sourceDate: date(structured ? asset.purchase.date : asset.purchaseDate)?.toISOString() ?? null } };
}
function salvage(asset, quality, allowZero) {
  const raw = asset.purchase?.salvageValue;
  const hasEvidence = typeof asset.purchase?.salvageEvidenceRef === 'string' && asset.purchase.salvageEvidenceRef.trim();
  if (present(raw) && !money(raw)) {
    quality.conflicts.push('invalid_salvage');
    return { rawAmount: raw, recordedAmount: null, planningAmount: null, basis: 'invalid', reference: null };
  }
  if (present(raw) && (raw > 0 || hasEvidence)) return { rawAmount: raw, recordedAmount: raw, planningAmount: raw, basis: 'recorded', reference: hasEvidence ? asset.purchase.salvageEvidenceRef : null };
  if (raw === 0) quality.conflicts.push('legacy_default_ambiguous_salvage_zero');
  if (allowZero) quality.assumptions.push('zero_planning_salvage');
  else quality.missingFields.push('planning_salvage');
  return { rawAmount: raw ?? null, recordedAmount: null, planningAmount: allowZero ? 0 : null, basis: allowZero ? 'assumption' : 'unknown', reference: allowZero ? POLICY_VERSION : null };
}
function replacement(template, quality, asOf) {
  const b = template?.benchmark;
  const field = present(b?.averageQuotedPrice) ? 'averageQuotedPrice' : present(b?.averageListPrice) ? 'averageListPrice' : null;
  if (!field) {
    quality.missingFields.push('replacement_estimate');
    return { amount: null, currency: null, status: 'unknown', source: null };
  }
  const source = { type: field === 'averageQuotedPrice' ? 'template_average_quoted_price' : 'template_average_list_price', reference: b.source || null, sourceDate: date(b.reportDate)?.toISOString() ?? null, validThrough: null, confidence: ['low', 'medium', 'high'].includes(b.confidence) ? b.confidence : null };
  if (!money(b[field]) || (present(b.reportDate) && (!date(b.reportDate) || date(b.reportDate) > asOf))) {
    quality.conflicts.push('invalid_replacement_evidence');
    return { amount: null, currency: null, status: 'invalid', source };
  }
  if (!source.sourceDate) quality.missingFields.push('replacement_source_date');
  quality.missingFields.push('replacement_currency', 'replacement_validity');
  return { amount: b[field], currency: null, status: 'estimated', estimateScope: 'like_for_like_equipment', source, resolutionVersion: CALCULATION_VERSION };
}
function depreciation(basis, serviceAge, expectedLife, salvageValue, quality) {
  const missingInputs = [];
  if (basis.amount === null) missingInputs.push('acquisition_basis');
  if (serviceAge.years === null) missingInputs.push('service_start');
  if (!life(expectedLife.years)) missingInputs.push('expected_life');
  if (salvageValue.planningAmount === null) missingInputs.push('planning_salvage');
  if (basis.amount !== null && salvageValue.planningAmount > basis.amount) {
    missingInputs.push('valid_salvage'); quality.conflicts.push('salvage_exceeds_acquisition_basis');
  }
  const result = { amount: null, currency: basis.currency, annualDepreciation: null, method: 'straight_line', status: 'insufficient_data', missingInputs };
  if (missingInputs.length) return result;
  const annual = (basis.amount - salvageValue.planningAmount) / expectedLife.years;
  if (!Number.isFinite(annual)) {
    quality.conflicts.push('nonfinite_depreciation');
    return {...result, missingInputs:['finite_depreciation']};
  }
  return { ...result, amount: round(Math.max(salvageValue.planningAmount, basis.amount - annual * serviceAge.years)), annualDepreciation: round(annual), status: 'estimated' };
}
const TEXT = {
  expected_life_reached: 'Adopted expected-life threshold reached; replacement review recommended.',
  expected_life_not_reached: 'Adopted expected-life threshold not reached.',
  service_age_unknown: 'Service start is unknown.',
  invalid_service_date: 'Service start is invalid.',
  service_not_started: 'Service has not started at the assessment date.',
  expected_life_unknown: 'Usable expected life is unavailable.',
  policy_not_configured: 'No adopted age-based replacement policy is configured.',
  age_policy_disabled: 'Age-based replacement policy is explicitly disabled.',
};
function recommendation(age, expected) {
  let code, state = 'insufficient_data';
  if (expected.status === 'disabled') code = 'age_policy_disabled';
  else if (!expected.isAdopted) code = expected.status === 'unknown' || expected.status === 'invalid' ? 'expected_life_unknown' : 'policy_not_configured';
  else if (!life(expected.years)) code = 'expected_life_unknown';
  else if (age.years === null) code = ({invalid:'invalid_service_date',not_started:'service_not_started'})[age.status] || 'service_age_unknown';
  else { const reached = age.years >= expected.years; state = reached ? 'recommended' : 'not_recommended'; code = reached ? 'expected_life_reached' : 'expected_life_not_reached'; }
  return { state, meaning: 'replacement_review', reasonCodes: [code], displayText: TEXT[code], rules: [{code:'adopted_expected_life', status: state === 'insufficient_data' ? 'insufficient_data' : 'evaluated', triggered: state === 'insufficient_data' ? null : state === 'recommended', reasonCode:code, inputs:{serviceYears:age.years,expectedLifeYears:expected.years}}] };
}
function buildAssetLifecycleAssessment({asset, template = null, organizationPolicy = null, maintenanceTotals = null, asOf = new Date(), computedAt = asOf, policyVersion = POLICY_VERSION, allowZeroSalvageAssumption = true}) {
  const at = date(asOf), computed = date(computedAt);
  if (!at || !computed) throw new TypeError('Valid lifecycle evaluation dates are required');
  if (policyVersion !== POLICY_VERSION) throw new TypeError('Unsupported lifecycle policy version');
  const quality = { missingFields: [], assumptions: [], conflicts: [] };
  const serviceAge = resolveServiceAge(asset, at, quality);
  const expectedLife = resolveExpectedLife(asset, template, organizationPolicy, quality, at);
  const acquisitionBasis = acquisition(asset, quality);
  const salvageValue = salvage(asset, quality, allowZeroSalvageAssumption);
  const estimatedDepreciatedValue = depreciation(acquisitionBasis, serviceAge, expectedLife, salvageValue, quality);
  const replacementValue = replacement(template, quality, at);
  return {
    schemaVersion: SCHEMA_VERSION, assetId: String(asset._id ?? ''), asOf: at.toISOString(), computedAt: computed.toISOString(),
    versions: { lifecycleCalculation: CALCULATION_VERSION, lifecyclePolicy: policyVersion, economicCalculation: 'wo-cost-v1' },
    serviceAge, expectedLife,
    capital: { acquisitionBasis, salvage: salvageValue, estimatedDepreciatedValue, accountingBookValue:{amount:null,currency:null,status:'not_available',source:null}, replacementValue },
    maintenance: { primaryScope: 'directMaintenance', window: {start:new Date(at-DAY_MS*365).toISOString(),end:at.toISOString(),startInclusive:true,endInclusive:true,dateField:'completionDate',statuses:['Completed']}, lifetime:maintenanceTotals?.lifetime?.scopes ?? null,last365Days:maintenanceTotals?.last12Months?.scopes ?? null, eligibleLifetimeWorkOrderCount:maintenanceTotals?.lifetime?.count ?? null, periodWorkOrderCount:maintenanceTotals?.last12Months?.count ?? null, dateExcludedWorkOrderCount:maintenanceTotals?.excludedCompletionDateCount ?? null },
    replacementAssessment: recommendation(serviceAge, expectedLife), quality,
  };
}
function lifecycleCompatibilityMetrics(assessment, totals) {
  const state = assessment.replacementAssessment.state;
  return {
    totalMaintenanceCost: totals.lifetime.total, projectedAnnualMaintenance: totals.last12Months.total,
    maintenanceScopes: {lifetime:totals.lifetime.scopes,last12Months:totals.last12Months.scopes},
    calculationVersion:'wo-cost-v1', currentBookValue:assessment.capital.estimatedDepreciatedValue.amount,
    annualDepreciation:assessment.capital.estimatedDepreciatedValue.annualDepreciation,
    yearsInService:assessment.serviceAge.years, replacementRecommended:state === 'insufficient_data' ? null : state === 'recommended',
    replacementAssessmentState:state, replacementReason:assessment.replacementAssessment.displayText,
    costRecommendationStatus:'not_configured', computedAt:assessment.computedAt,
    deprecatedAliases:{currentBookValue:'capital.estimatedDepreciatedValue.amount (planning estimate, not accounting)',projectedAnnualMaintenance:'observed last-365-day internal labor + parts; not projected'},
  };
}
module.exports = { buildAssetLifecycleAssessment, lifecycleCompatibilityMetrics, POLICY_VERSION, isLifecycleDate: value => date(value) !== null };
