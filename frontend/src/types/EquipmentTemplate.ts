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
