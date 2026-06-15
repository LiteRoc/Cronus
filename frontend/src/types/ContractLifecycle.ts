// src/types/ContractLifecycle.ts

export interface ContractLifecycleSummary {
  coveredAssetCount: number;
  hydratedAssetCount: number;
  replacementRecommendedCount: number;
  replacementRecommendedPercent: number;
  projectedAnnualMaintenance: number;
  currentBookValue: number;
  estimatedReplacementValue: number;
  assetsMissingReplacementValue: number;
}

export interface ContractLifecycleReplacementCandidate {
  _id: string;
  ctrlNumber: string;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  replacementReason?: string | null;
  yearsInService?: number | null;
  currentBookValue: number;
  projectedAnnualMaintenance: number;
  estimatedReplacementValue: number;
}

export interface ContractLifecycleIntelligenceResponse {
  contract: {
    _id: string;
    contractNumber: string;
    name: string;
    status: string;
    type: string;
    startDate: string;
    endDate: string;
    totalValue: number;
  };
  summary: ContractLifecycleSummary;
  replacementCandidates: ContractLifecycleReplacementCandidate[];
}