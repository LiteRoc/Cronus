const Asset = require('../models/Asset');
const {
  cohortFilter
} = require('./templateOperationalPopulation');
const {
  assessAssets
} = require('./assetLifecycleAssessmentBatch');
const {
  aggregateLifecycle
} = require('./lifecycleAggregation');
async function getTemplateLifecycleAggregation(template, {
  facilityId,
  asOf = new Date()
} = {}) {
  const assets = await Asset.find(cohortFilter(template._id, facilityId)).lean();
  const pendingAssetCount = await Asset.countDocuments(cohortFilter(template._id, facilityId, ['Pending']));
  const results = await assessAssets(assets.map(asset => ({
    ...asset,
    templateId: template
  })), {
    asOf
  });
  const rows = assets.map(asset => results.get(String(asset._id)) || {
    assetId: String(asset._id),
    assessment: null,
    reason: 'assessment_unavailable'
  });
  const aggregate = aggregateLifecycle(rows, {
    asOf
  });
  return {
    ...aggregate,
    population: {
      ...aggregate.population,
      basis: 'template_operational_fleet',
      facilityId: String(facilityId),
      templateId: String(template._id),
      statuses: ['Active', 'Inactive'],
      excludeArchived: true,
      excludeDeleted: true,
      pendingAssetCount
    },
    links: {
      assets: `/assets?templateId=${template._id}`,
      replacementRecommendedAssets: `/assets?templateId=${template._id}&replacementRecommended=true`,
      filterAuthority: 'legacy_cache_until_gitea_8'
    }
  };
}
module.exports = {
  getTemplateLifecycleAggregation
};
