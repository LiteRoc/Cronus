// src/types/Dashboard.ts

// src/types/Dashboard.ts

export interface ReplacementForecastAsset {
  _id: string;
  templateId?: string | null;
  ctrlNumber: string;
  manufacturer: string;
  model: string;
  estimatedReplacementCost: number;
}

export interface ReplacementForecastYear {
  year: number;
  assetCount: number;
  estimatedCapitalNeed: number;
  assets: ReplacementForecastAsset[];
}

export interface ReplacementForecastResponse {
  forecastYears: ReplacementForecastYear[];

  /**
   * Assets that had sufficient lifecycle information
   * to be included in the forecast.
   */
  totalForecastedAssets: number;

  /**
   * Total assets evaluated for forecasting.
   * Some assets may be excluded due to missing
   * benchmark or lifecycle data.
   */
  totalAssetsEvaluated: number;

  /**
   * Sum of estimated replacement costs across
   * all forecast years.
   */
  totalEstimatedCapitalNeed: number;
}