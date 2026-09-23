export interface CostScope {
  knownSubtotal: number;
  total: number | null;
  isComplete: boolean;
  missingComponents: Array<{ component?: string; reason: string; entryId?: string }>;
  valuationBases?: string[];
  fullyPricedCount?: number;
  workOrderCount?: number;
}
export interface WorkOrderCosts {
  calculationVersion?: string | null;
  cacheState?: 'current' | 'stale' | 'legacy' | 'unsupported';
  inputRevision?: number | null;
  calculatedAt?: string | null;
  labor: number | null;
  parts: number | null;
  total: number | null;
  scopes: { internal: CostScope; vendorDirect: CostScope; directMaintenance: CostScope };
}

export interface EconomicPricing {
  version?: number;
  basis: 'unknown' | 'blended_internal' | 'catalog_default' | 'documented';
  sourceKind?: string;
  sourceId?: string;
  sourceRevision?: number | string | null;
  capturedAt?: string;
  capturedBy?: string;
  unknownReason?: string;
  zeroEvidence?: boolean;
}
