import type { AssetLifecycleAssessment } from './AssetLifecycleAssessment';
export interface LifecycleMoneyAggregate {
  currency: string | null;
  knownSubtotal: number | null;
  total: number | null;
  isComplete: boolean;
  populationAssetCount: number;
  valuedAssetCount: number;
  missingAssetCount: number;
  unresolvedAssetCount: number;
  currencyUnknownAssetCount: number;
  currencyGroups: {
    currency: string;
    knownSubtotal: number;
    valuedAssetCount: number;
  }[];
  unidentifiedCurrencyValues: {
    assetId: string;
    amount: number;
  }[];
  missing: {
    assetId?: string;
    reason: string;
  }[];
}
export interface LifecycleMember {
  assetId: string;
  asset: {
    ctrlNumber?: string;
    manufacturer?: string;
    model?: string;
  } | null;
  replacementAssessment: AssetLifecycleAssessment['replacementAssessment'] | null;
  reason: string | null;
}
export interface LifecycleAggregation {
  schemaVersion: 'lifecycle-aggregate-v1';
  asOf: string;
  versions: Record<string, string>;
  population: {
    populationAssetCount: number;
    assessedAssetCount: number;
    unavailableAssessmentCount: number;
    basis?: string;
    facilityId?: string;
    pendingAssetCount?: number;
  };
  capital: Record<'replacementValue' | 'estimatedDepreciatedValue' | 'accountingBookValue', LifecycleMoneyAggregate>;
  replacementReview: {
    populationAssetCount: number;
    recommendedCount: number;
    notRecommendedCount: number;
    insufficientDataCount: number;
    unavailableAssessmentCount: number;
    evaluatedCount: number;
    recommendedPercentOfPopulation: number | null;
    recommendedPercentOfEvaluated: number | null;
  };
  age: {
    stateCounts: Record<'resolved' | 'estimated' | 'unknown' | 'invalid' | 'not_started' | 'unavailable', number>;
    buckets: {
      key: string;
      label: string;
      minInclusive: number;
      maxExclusive: number | null;
      count: number;
    }[];
  };
  maintenance: {
    primaryScope: 'directMaintenance';
    window: {
      type: string;
      durationDays: number;
      start: string;
      end: string;
      startInclusive: boolean;
      endInclusive: boolean;
      dateField: string;
      statuses: string[];
    };
    directMaintenance: {
      knownSubtotal: number;
      total: number | null;
      isComplete: boolean;
      currency: string;
      completeAssetCount: number;
      incompleteAssetCount: number;
      missingComponents: {
        assetId: string;
        reason?: string;
        component?: string;
      }[];
      valuationBases: string[];
      workOrders: {
        knownCount: number;
        knownFullyPricedCount: number;
        isComplete: boolean;
      };
      statistics: {
        fleetMean: number | null;
        completeRecordSampleMean: number | null;
        completeRecordSampleMedian: number | null;
        sampleAssetCount: number;
        populationAssetCount: number;
      };
    };
  };
  members: LifecycleMember[];
  deprecatedAliases: Record<string, string>;
}
