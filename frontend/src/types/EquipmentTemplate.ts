// src/types/EqupmentTemplate.ts

export interface EquipmentTemplate {
  _id: string,
  di: string,
  manufacturer: string,
  model: string,
  description: string,
  equipmentClass: string,
  brandName?: string,
  issuingAgency?: string,
  fdaProductCode?: string,
  gmdnTerm?: string,
  gmdnCode?: string,
  classificationName?: string,
  kind: string,
  alarm: boolean,
  hipaa: boolean,
  autoAddPMProcedure: boolean,
  requirePmPlan: boolean,
  excludeFromLifecycle: boolean,
  excludeFromAEM: boolean,
  manufacturerRecommendedPMFrequency: number,
  verified: boolean
};

export interface TemplateListResponse {
  templates: EquipmentTemplate[];
  totalCount: number;
};