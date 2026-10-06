import type { CostScope } from './WorkOrderCosts';
export type ReplacementReviewState = 'recommended' | 'not_recommended' | 'insufficient_data';
export interface LifecycleSource {
  type: string;
  field?: string;
  reference?: string | null;
  sourceDate?: string | null;
  confidence?: string | null;
  adoptionStatus?: string;
}
export interface LifecycleCapitalValue {
  amount: number | null;
  currency: string | null;
  status: string;
  source?: LifecycleSource | null;
  missingInputs?: string[];
}
export interface AssetLifecycleAssessment {
  schemaVersion: 'asset-lifecycle-v2';
  assetId: string;
  asOf: string;
  computedAt: string;
  versions: { lifecycleCalculation: string; lifecyclePolicy: string; economicCalculation: string };
  serviceAge: { startDate: string | null; years: number | null; status: 'resolved' | 'estimated' | 'unknown' | 'invalid' | 'not_started'; source: LifecycleSource | null; isProxy: boolean };
  expectedLife: { years: number | null; referenceYears?: number; status: string; isAdopted: boolean; source: LifecycleSource | null };
  capital: {
    acquisitionBasis: LifecycleCapitalValue;
    estimatedDepreciatedValue: LifecycleCapitalValue;
    accountingBookValue: LifecycleCapitalValue;
    replacementValue: LifecycleCapitalValue;
    salvage: { rawAmount: number | null; recordedAmount: number | null; planningAmount: number | null; basis: string; reference: string | null };
  };
  maintenance: {
    primaryScope: 'directMaintenance';
    window: { start: string; end: string; startInclusive: boolean; endInclusive: boolean; dateField: string; statuses: string[] };
    lifetime: Record<string, CostScope> | null;
    last365Days: Record<string, CostScope> | null;
  };
  replacementAssessment: {
    state: ReplacementReviewState;
    meaning: 'replacement_review';
    reasonCodes: string[];
    displayText: string;
    rules: { code: string; status: string; triggered: boolean | null; reasonCode: string; inputs: { serviceYears: number | null; expectedLifeYears: number | null } }[];
  };
  quality: { missingFields: string[]; assumptions: string[]; conflicts: string[] };
}
