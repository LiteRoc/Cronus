import type { LifecycleAggregation } from './LifecycleAggregation';
import type { AssetLifecycleAssessment } from './AssetLifecycleAssessment';
import type { Contract } from './Contract';
export interface ContractLifecycleIntelligenceResponse extends LifecycleAggregation {
  contract: {
    _id: string;
    contractNumber: string;
    name: string;
    status: string;
    type: string;
    startDate: string;
    endDate: string;
    totalValue: number;
    totalValueMeaning: string;
  };
  coverage?: Contract['coverage'];
  summary: {
    coveredAssetCount: number;
    hydratedAssetCount: number;
    replacementRecommendedCount: number;
    replacementRecommendedPercent: number | null;
    projectedAnnualMaintenance: number | null;
    currentBookValue: number | null;
    estimatedReplacementValue: number | null;
    assetsMissingReplacementValue: number;
  };
  replacementCandidates: ({
    _id: string;
    ctrlNumber?: string;
    replacementReason?: string;
    capital: AssetLifecycleAssessment['capital'];
    serviceAge: AssetLifecycleAssessment['serviceAge'];
  })[];
}
