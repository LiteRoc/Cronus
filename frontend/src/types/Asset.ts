// src/types/Asset.ts

export interface MaintenanceSchedule {
  frequency?: string; // e.g., Monthly, Quarterly, Annually
  intervalMonths?: number;
  lastMaintenance?: string; // ISO date string
  nextMaintenance?: string; // ISO date string
  procedure?: string; // Procedure ID or name
};

export interface Attribute {
  name: string;
  value: string | number | boolean;
};

export interface Asset {
  _id: string;
  ctrlNumber: string;
  manufacturer: string;
  model: string;
  modelNumber?: string;
  serialNumber?: string;
  revisionNumber?: string;
  description?: string;

  // Location / Org
  facilityId: string;
  departmentId?: string;
  locationNote?: string;

  // Status & Metadata
  status?: 'Active' | 'Inactive' | 'Retired' | 'Pending';
  notes?: string;
  isArchived?: boolean;

  // Maintenance
  maintenanceSchedule?: MaintenanceSchedule;

  // Custom Attributes
  attributes?: Record<string, string>;

  // Parent / Child Assets
  parentAsset?: string; // assetId
  relationToParent?: string; // e.g. "Component", "Accessory"
  children?: string[]; // array of asset IDs

  // Compliance Flags
  riskLevel?: 'Low' | 'Medium' | 'High';
  isHIPAARelevant?: boolean;
  isAlarmed?: boolean;
  isSecuritySensitive?: boolean;
  isAEMExcluded?: boolean;

  // Financials
  purchaseDate?: string; // ISO date
  purchaseCost?: number;
  budgetValue?: number;
  contractValue?: number;
  manufacturerRecommendedPMFrequency?: number;

  // FDA / Regulatory
  equipmentClass?: string;
  classificationName?: string;
  regulationNumber?: string;
  panel?: string; // e.g. "General Hospital"
  prescriptionRequired?: boolean;
  otc?: boolean;
  submissionNumber?: string;
  manufacturerDUNS?: string;
  gmdnDefinition?: string;

  // Attachments (for future use)
  documents?: string[]; // file IDs or URLs
  images?: string[]; // image URLs or base64 strings

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
};

// Query options your /assets endpoint understands.
// Keep these loose so you don’t fight the backend.
export type AssetFilters = {
  q?: string;                 // free-text (ctrl #, mfr, model, serial, etc.)
  status?: string;            // e.g., "Active", "Inactive", "Archived"
  departmentId?: string;
  facilityId?: string;        // optional (you usually pass via header or helper)
  manufacturer?: string;
  model?: string;
  ctrlNumber?: string;
  serialNumber?: string;

  // Projection & sorting (only if your API supports them)
  select?: string;            // e.g., "_id,ctrlNumber,manufacturer,model,serialNumber,status"
  sortBy?: "ctrlNumber" | "manufacturer" | "model" | "serialNumber" | "status" | "createdAt" | "updatedAt";
  sortDir?: "asc" | "desc";

  // Optional date range filters (if supported)
  start?: string;             // ISO date
  end?: string;               // ISO date
};

// Shape returned by GET /assets used by useAssets()
// Your hook reads: assets, currentPage, totalPages, totalAssets
export interface AssetListResponse {
  assets: Asset[];     // list payload
  currentPage: number; // 1-based current page
  totalPages: number;  // total number of pages
  totalAssets: number; // total matching records
  pageSize?: number;   // optional, if your API returns it
};
