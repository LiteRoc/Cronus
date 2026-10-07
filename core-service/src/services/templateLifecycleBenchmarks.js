// Authorized local cohort only. Reference benchmark evidence is separate from fleet data.
import Template from '../models/EquipmentTemplate.js';
import aggregation from './templateLifecycleAggregation.js';
function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
export async function getTemplateMaintenanceBenchmarks(templateId, opts = {}) {
  if (!opts.facilityId) throw new Error('Selected Facility is required for operational benchmarks');
  const template = opts.template ?? (await Template.findById(templateId).lean());
  if (!template) throw new Error('Template unavailable');
  const facts = opts.aggregate ?? (await aggregation.getTemplateLifecycleAggregation(template, {
    facilityId: opts.facilityId,
    asOf: opts.now ?? new Date()
  }));
  const direct = facts.maintenance.directMaintenance;
  // Deprecated narrow statistics keep their old scope and disclose sample selection.
  const rows = facts.rows,
    annual = rows.map(row => row.metrics?.projectedAnnualMaintenance).filter(value => typeof value === 'number' && Number.isFinite(value)),
    lifetime = rows.map(row => row.metrics?.totalMaintenanceCost).filter(value => typeof value === 'number' && Number.isFinite(value));
  const tenant = {
    scope: 'internal_labor_parts',
    deprecated: true,
    sampleAssets: facts.population.populationAssetCount,
    completeAssetCount: annual.length,
    avgAnnualMaintenance: avg(annual),
    medianAnnualMaintenance: annual.length ? [...annual].sort((a, b) => a - b).slice(Math.floor((annual.length - 1) / 2), Math.floor(annual.length / 2) + 1).reduce((s, v) => s + v, 0) / (annual.length % 2 ? 1 : 2) : null,
    avgLifetimeMaintenance: avg(lifetime),
    sampleWOsAnnual: rows.reduce((sum, row) => sum + (row.assessment?.maintenance.periodWorkOrderCount ?? 0), 0),
    sampleWOsLifetime: rows.reduce((sum, row) => sum + (row.assessment?.maintenance.eligibleLifetimeWorkOrderCount ?? 0), 0),
    calculationVersion: 'wo-cost-v1',
    statisticsBasis: 'complete_record_sample',
    directMaintenance: direct,
    population: facts.population,
    window: facts.maintenance.window
  };
  return {
    local: {
      population: facts.population,
      directMaintenance: direct,
      window: facts.maintenance.window
    },
    tenant,
    global: null,
    globalStatus: 'not_authorized',
    referenceEvidence: template.benchmark ?? null
  };
}
