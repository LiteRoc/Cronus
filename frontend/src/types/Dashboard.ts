import type { LifecycleMoneyAggregate } from './LifecycleAggregation';
import type { LifecycleFilterCoverage } from './Asset';
export type ReplacementForecastResponse = {
  schemaVersion: 'lifecycle-forecast-v2';
  asOf: string;
  lifecycleCoverage: LifecycleFilterCoverage;
  isComplete: boolean;
  projectionUnavailableCount: number;
  totalForecastedAssets: number;
  totalAssetsEvaluated: number;
  totalEstimatedCapitalNeed: number | null;
  capital: LifecycleMoneyAggregate;
  forecastYears: {
    year: number;
    assetCount: number;
    estimatedCapitalNeed: number | null;
    capital: LifecycleMoneyAggregate;
    assets: {
      _id: string;
      ctrlNumber: string;
      manufacturer: string;
      model: string;
      estimatedReplacementCost: number | null;
      currency: string | null;
      replacementAssessmentState: string;
    }[];
  }[];
};
export type ReplacementForecastYear = ReplacementForecastResponse['forecastYears'][number];
export type ReplacementForecastAsset = ReplacementForecastYear['assets'][number];
