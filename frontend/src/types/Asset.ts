// src/types/Asset.ts

export interface MaintenanceSchedule {
  frequency?: string;
  intervalMonths?: number;
  lastMaintenance?: string;
  nextMaintenance?: string;
  procedure?: string;
}

export interface Benchmark {
  source?: string;
  reportDate?: string;
  expectedUsefulLifeYears?: number;
  averageListPrice?: number;
  averageQuotedPrice?: number;
  expectedAnnualMaintenance?: number;
  expectedCapitalCostRatio?: number;
  marketInterest?: string;
  confidence?: string;
  notes?: string;
}

export interface AssetTemplateRef {
  _id: string;
  manufacturer?: string;
  model?: string;
  description?: string;
  benchmark?: Benchmark;
}

export interface BenchmarkComparison {
  capitalValue?: number;
  actualAnnualMaintenance?: number;
  expectedAnnualMaintenance?: number;
  actualCapitalCostRatio?: number;
  expectedCapitalCostRatio?: number;
  annualMaintenanceVariance?: number;
  annualMaintenanceVariancePercent?: number;
  ccrVariance?: number;
  ccrVariancePercent?: number;
}

export interface AssetLifecycleMetrics {
  totalMaintenanceCost?: number;
  last12MonthsMaintenanceCost?: number;
  currentBookValue?: number;
  projectedAnnualMaintenance?: number;
  replacementRecommended?: boolean;
  replacementReason?: string | null;
  yearsInService?: number;
  annualDepreciation?: number;
  computedAt?: string;
}

export interface Asset {
  _id: string;
  ctrlNumber: string;
  manufacturer: string;
  model: string;
  modelNumber?: string;
  serialNumber?: string;
  revisionNumber?: string;
  description?: string;

  templateId?: string | AssetTemplateRef | null;
  contractId?: string;

  facilityId: string;
  departmentId?: string;
  locationNote?: string;

  status?: "Active" | "Inactive" | "Retired" | "Pending";
  notes?: string;
  isArchived?: boolean;

  maintenanceSchedule?: MaintenanceSchedule;
  attributes?: Record<string, string>;

  parentAsset?: string;
  relationToParent?: string;
  children?: string[];

  riskLevel?: "Low" | "Medium" | "High";
  isHIPAARelevant?: boolean;
  isAlarmed?: boolean;
  isSecuritySensitive?: boolean;
  isAEMExcluded?: boolean;

  purchaseDate?: string;
  purchaseCost?: number;
  budgetValue?: number;
  contractValue?: number;
  manufacturerRecommendedPMFrequency?: number;

  equipmentClass?: string;
  classificationName?: string;
  regulationNumber?: string;
  panel?: string;
  prescriptionRequired?: boolean;
  otc?: boolean;
  submissionNumber?: string;
  manufacturerDUNS?: string;
  gmdnDefinition?: string;

  documents?: string[];
  images?: string[];

  metrics?: AssetLifecycleMetrics;
  benchmarkComparison?: BenchmarkComparison;

  createdAt?: string;
  updatedAt?: string;
}

export interface AssetLifecycleResponse {
  assetId: string;
  templateId?: string | AssetTemplateRef | null;
  purchase: Record<string, string | number | boolean | null> | null;
  metrics: AssetLifecycleMetrics;
  benchmarkComparison?: BenchmarkComparison;
  template?: AssetTemplateRef | null;
}

export type AssetFilters = {
  q?: string;
  status?: string;
  departmentId?: string;
  facilityId?: string;
  manufacturer?: string;
  model?: string;
  ctrlNumber?: string;
  serialNumber?: string;
  select?: string;
  sortBy?: "ctrlNumber" | "manufacturer" | "model" | "serialNumber" | "status" | "createdAt" | "updatedAt";
  sortDir?: "asc" | "desc";
  start?: string;
  end?: string;
};

export interface AssetListResponse {
  assets: Asset[];
  currentPage: number;
  totalPages: number;
  totalAssets: number;
  pageSize?: number;
}