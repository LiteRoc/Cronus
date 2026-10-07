import mongoose from 'mongoose';
import Contract from '../models/Contract.js';
import { buildTenantFilter } from '../middleware/tenantScope.js';
import { resolveCurrentContractCoverage, inspectVendorCoverage } from '../services/currentContractCoverage.js';
export async function getContractLifecycleIntelligence(req, res) {
  try {
    const {
      id
    } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({
      message: 'Invalid contract ID'
    });
    const contract = await Contract.findOne({
      _id: id,
      ...buildTenantFilter(req)
    }).lean();
    if (!contract) return res.status(404).json({
      message: 'Contract not found'
    });
    const coverage = resolveCurrentContractCoverage(contract),
      assetIds = coverage.assetIds;
    if (!mongoose.Types.ObjectId.isValid(String(contract.facilityId))) return res.status(409).json({
      message: 'Contract Facility evidence is unavailable'
    });
    // Core performs bounded assessment chunks at one evaluation instant.
    const asOf = new Date().toISOString();
    let aggregate;
    try {
      const {
        data
      } = await req.core.post('/assets/lifecycle/batch', {
        assetIds,
        asOf
      }, {
        headers: {
          'x-facility-id': String(contract.facilityId)
        }
      });
      if (data?.schemaVersion !== 'lifecycle-aggregate-v1' || data.asOf !== asOf || data.facilityId !== String(contract.facilityId) || !Array.isArray(data.rows) || data.rows.length !== assetIds.length || data.rows.some((row, index) => row.assetId !== assetIds[index]) || data.population?.populationAssetCount !== assetIds.length) throw new Error('Invalid canonical response');
      const assessed = data.rows.filter(row => row.assessment).length;
      const review = data.replacementReview;
      if (data.population.assessedAssetCount !== assessed || data.population.unavailableAssessmentCount !== assetIds.length - assessed || !review || review.recommendedCount + review.notRecommendedCount + review.insufficientDataCount + review.unavailableAssessmentCount !== assetIds.length || !data.maintenance?.directMaintenance || !data.age?.buckets || ['replacementValue', 'estimatedDepreciatedValue', 'accountingBookValue'].some(key => !data.capital?.[key]) || data.rows.some(row => row.assessment && (row.assessment.schemaVersion !== 'asset-lifecycle-v2' || row.assessment.assetId !== row.assetId || row.assessment.asOf !== asOf || !row.assessment.capital || !['recommended', 'not_recommended', 'insufficient_data'].includes(row.assessment.replacementAssessment?.state)))) throw new Error('Invalid canonical facts');
      aggregate = data;
    } catch (_) {
      return res.status(503).json({
        message: 'Canonical lifecycle aggregation unavailable',
        population: {
          basis: 'current_contract_coverage',
          populationAssetCount: assetIds.length,
          assessedAssetCount: 0,
          unavailableAssessmentCount: assetIds.length
        },
        coverage
      });
    }
    const rows = aggregate.rows,
      review = aggregate.replacementReview;
    const narrow = rows.map(row => row.metrics?.projectedAnnualMaintenance);
    const narrowTotal = narrow.every(value => typeof value === 'number' && Number.isFinite(value)) ? narrow.reduce((sum, value) => sum + value, 0) : null;
    const replacementCandidates = rows.filter(row => row.assessment?.replacementAssessment.state === 'recommended').map(row => ({
      ...row.asset,
      _id: row.assetId,
      replacementReason: row.assessment.replacementAssessment.displayText,
      replacementAssessment: row.assessment.replacementAssessment,
      serviceAge: row.assessment.serviceAge,
      capital: row.assessment.capital
    }));
    const {
      rows: discard,
      facilityId,
      ...facts
    } = aggregate;
    return res.json({
      ...facts,
      population: {
        ...facts.population,
        basis: 'current_contract_coverage',
        facilityId: String(contract.facilityId),
        currentCoveredAssetCount: assetIds.length,
        historicalReconstructionSupported: false
      },
      coverage: {
        ...coverage,
        vendorResponsibility: inspectVendorCoverage(contract)
      },
      contract: {
        _id: String(contract._id),
        contractNumber: contract.contractNumber,
        name: contract.name,
        status: contract.status,
        type: contract.type,
        startDate: contract.startDate,
        endDate: contract.endDate,
        totalValue: contract.totalValue,
        totalValueMeaning: 'original_base_annual_value'
      },
      members: rows.map(row => ({
        assetId: row.assetId,
        asset: row.asset ?? null,
        replacementAssessment: row.assessment?.replacementAssessment ?? null,
        reason: row.reason ?? null
      })),
      replacementCandidates,
      summary: {
        coveredAssetCount: assetIds.length,
        hydratedAssetCount: facts.population.assessedAssetCount,
        assessedAssetCount: facts.population.assessedAssetCount,
        unavailableAssessmentCount: facts.population.unavailableAssessmentCount,
        replacementRecommendedCount: review.recommendedCount,
        replacementRecommendedPercent: review.recommendedPercentOfPopulation,
        replacementRecommendedPercentDenominator: 'populationAssetCount',
        projectedAnnualMaintenance: narrowTotal,
        directMaintenance: facts.maintenance.directMaintenance,
        currentBookValue: facts.capital.estimatedDepreciatedValue.total,
        estimatedReplacementValue: facts.capital.replacementValue.total,
        assetsMissingReplacementValue: facts.capital.replacementValue.missingAssetCount
      },
      deprecatedAliases: {
        currentBookValue: 'complete estimated depreciated value, not accounting; null if incomplete',
        estimatedReplacementValue: 'complete canonical replacement total; null if incomplete',
        projectedAnnualMaintenance: 'observed internal labor + parts compatibility scope; not projected',
        replacementRecommendedPercent: 'percent of current coverage population; null if empty',
        hydratedAssetCount: 'successfully assessed members; unavailable members remain in population'
      }
    });
  } catch (error) {
    if (error.message?.startsWith('Forbidden:')) return res.status(403).json({
      message: 'Facility access denied'
    });
    return res.status(500).json({
      message: 'Failed to compute contract lifecycle intelligence'
    });
  }
}
