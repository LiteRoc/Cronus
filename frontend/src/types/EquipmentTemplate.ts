// src/types/EquipmentTemplate.ts

export interface EquipmentTemplate {
  _id: string;
  manufacturer: string;
  model: string;
  description: string;
  verified: boolean;
  updatedAt?: string;
  createdAt?: string;

  // FDA / UDI fields
  di?: string;
  brandName?: string;
  fdaProductCode?: string;
  issuingAgency?: string;
  gmdnTerm?: string;
  gmdnDefinition?: string;
  catalogNumber?: string;
  versionOrModel?: string;
  mrSafetyStatus?: string;
  equipmentClass?: string;
  status?: string;

  // Custom flags / settings
  alarm?: boolean;
  hipaa?: boolean;
  autoAddPmProcedure?: boolean;
  autoAddPMProcedure?: boolean; // backward compat in UI
  requirePmPlan?: boolean;
  excludeFromLifecycle?: boolean;
  excludeFromAEM?: boolean;
  manufacturerRecommendedPMFrequency?: number;
  isTestEquipment?: boolean;
  eolYears?: number;
  lineItemPricing?: number;

  benchmark?: TemplateBenchmark;

  // Extra fields
  classificationName?: string;
  regulationNumber?: string;
  panel?: string;
  recordStatus?: string;
  prescriptionRequired?: boolean;
  otc?: boolean;
  submissionNumber?: string;
  manufacturerDUNS?: string;

  // Optional kind/subType
  kind?: string;
  subType?: string;
  duplicateOf?: string | null;
}

export interface TemplateListResponse {
  templates: EquipmentTemplate[];
  totalCount: number;
  totalPages?: number;
  currentPage?: number;
}

export interface TemplateLifecycleBenchmarks {
  sampleAssets: number;
  avgAnnualMaintenance: number;
  medianAnnualMaintenance: number;
  sampleWOsAnnual: number;
  avgLifetimeMaintenance: number;
  sampleWOsLifetime: number;
}

export interface TemplateLifecycleSummaryResponse {
  templateId: string;
  template: {
    _id: string;
    manufacturer: string;
    model: string;
    description?: string;
  };
  lifecycleDefaults: {
    expectedLifeYears: number | null;
    typicalAnnualMaintenance: number | null;
  };
  summary: {
    totalAssets: number;
    ageBuckets: {
      "0-2": number;
      "3-5": number;
      "6-8": number;
      ">8": number;
      unknown: number;
    };
    averageAnnualMaintenancePerAsset: number;
    maintenanceSampleCount: number;
    replacementRecommendedCount: number;
    replacementRecommendedPercent: number;
  };
  benchmarks: {
    tenant: TemplateLifecycleBenchmarks;
    global: TemplateLifecycleBenchmarks;
  };
  links: {
    assets: string;
    replacementRecommendedAssets: string;
  };
}

export interface TemplateBenchmark {
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
