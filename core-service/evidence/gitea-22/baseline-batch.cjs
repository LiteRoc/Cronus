// Core-owned live canonical assessment orchestration shared by Asset and fleet APIs.
const Facility = require('../models/Facility');
const Organization = require('../models/Organization');
const {
  buildAssetLifecycleAssessment,
  lifecycleCompatibilityMetrics
} = require('./assetLifecycleAssessment');
const {
  maintenanceWindow
} = require('./lifecycleAggregation');
async function assessAssets(assets, {
  asOf = new Date()
} = {}) {
  const window = maintenanceWindow(asOf),
    groups = new Map(),
    result = new Map();
  for (const asset of assets) {
    const key = String(asset.facilityId ?? '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(asset);
  }
  for (const [facilityId, group] of groups) {
    let totals, organization;
    try {
      totals = await require('./lifecycleMaintenance').default.getMaintenanceTotalsBatch(group.map(asset => asset._id), {
        facilityId: facilityId || undefined,
        now: new Date(asOf),
        windowStart: new Date(window.start)
      });
      const facility = facilityId ? await Facility.findById(facilityId).select('organizationId').lean() : null;
      organization = facility?.organizationId ? await Organization.findById(facility.organizationId).select('lifecyclePolicies').lean() : null;
    } catch (_) {
      for (const asset of group) result.set(String(asset._id), {
        assetId: String(asset._id),
        assessment: null,
        reason: 'assessment_unavailable'
      });
      continue;
    }
    for (const asset of group) {
      const assetId = String(asset._id),
        template = asset.templateId && typeof asset.templateId === 'object' && asset.templateId.manufacturer !== undefined ? asset.templateId : null;
      try {
        const policies = (organization?.lifecyclePolicies ?? []).filter(policy => policy.templateId && String(policy.templateId) === String(template?._id ?? ''));
        const organizationPolicy = policies.length === 1 ? policies[0] : policies.length > 1 ? {
          ambiguous: true
        } : null;
        const maintenanceTotals = totals.get(assetId);
        if (!maintenanceTotals) throw new Error('Missing canonical maintenance');
        const assessment = buildAssetLifecycleAssessment({
          asset,
          template,
          organizationPolicy,
          maintenanceTotals,
          asOf: new Date(asOf)
        });
        result.set(assetId, {
          assetId,
          assessment,
          asset: {
            _id: assetId,
            ctrlNumber: asset.ctrlNumber ?? '',
            manufacturer: asset.manufacturer ?? '',
            model: asset.model ?? '',
            serialNumber: asset.serialNumber ?? ''
          },
          metrics: lifecycleCompatibilityMetrics(assessment, maintenanceTotals),
          maintenanceTotals
        });
      } catch (_) {
        result.set(assetId, {
          assetId,
          assessment: null,
          reason: 'assessment_unavailable'
        });
      }
    }
  }
  return result;
}
module.exports = {
  assessAssets
};
