// src/types/Contract.ts

import { CoverageCode } from "./Coverage";

export type AmendmentChangeType = "add" | "remove" | "update";

//export type CoverageCode = "FSC" | "PMWP" | "PMO" | "LBR" | "PARTS" | "HYB";
export type ServiceProviderType = "internal" | "vendor";

export type AmendmentItem = {
  assetId: string;
  deltaValue: number;
  note?: string;

  coverageCode: CoverageCode;
  serviceProviderType: ServiceProviderType;
  serviceProviderId?: string;
};

export interface Amendment {
  _id?: string;         // mongoose subdoc id (good to have)
  amendmentNumber?: string;

  date: string;         // effective date of the amendment
  description?: string;
  
  changeType: AmendmentChangeType;
  items?: AmendmentItem[];

  totalDelta?: number;
  status?: "draft" | "submitted" | "approved" | "applied" | "declined" | "voided" | "superseded";
  appliedAt?: string;
  appliedBy?: string;

  setsBase?: boolean;
  excludeFromFinancials?: boolean;
};

export interface Contract {
  _id: string;
  contractNumber?: string;
  type: "vendor" | "customer";
  name: string;
  facilityId: string,
  linkedVendor?: {
    _id: string;
    name: string;
  };
  linkedCustomer?: {
    _id: string;
    name: string;
  };
  startDate: string;
  endDate: string;
  status: "draft" | "submitted" | "approved" | "applied" | "declined" | "voided" | "superseded";
  totalValue: number;
  coveredAssets?: string[];
  amendments?: Amendment[];
  amendmentSeq?: number;
  linkedWorkOrders?: string[];
  notes?: string;
  vendorLinks?: VendorLink[];
  createdAt?: string;
  updatedAt?: string;
};

export type VendorLink = {
  _id?: string;
  vendorId: string;
  nameSnapshot?: string;
  coverageType: "full" | "pm-only" | "parts-only" | "labor-only" | "t&m";
  startDate: string;
  endDate: string;
  annualCost: number;
  deductible?: number;
  notes?: string;
  coveredAssetIds?: string[];
  coveredAssetsCount?: number;
  coveredAssets?: Array<{
    _id: string;
    ctrlNumber?: string;
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    facilityId?: string;
    departmentId?: string | null;
  }>;
  includedWorkCodes?: string[];
  exclusions?: string[];
  invoices?: Array<{
    invoiceNumber?: string;
    amount: number;
    date: string;
    status?: string;
    notes?: string;
  }>;
  metricsCache?: {
    updatedAt?: string;
    costToServeYTD?: number;
    woCountYTD?: number;
    pmCompliance?: number;
  };
};

export type AssetCost = {
  assetId: string;
  woCount: number;
  partsCost: number;
  laborHours: number;
  travelHours: number;
  laborCost: number;
  travelCost: number;
  totalCost: number;
}

export type ContractOverview = {
  contract: Contract;

  assets: Array<{
    _id: string;
    ctrlNumber?: string;
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
  }>;

  workOrders: {
    totalYTD: number;
    avgResponseTimeHours: number | null;
    openCount: number;
    closedCount: number;
  };

  labor?: {
    hoursYTD: number;
    costYTD: number;
    blendedRate: number;
  };

  travel?: {
    hoursYTD: number;
    costYTD: number;
    blendedRate: number;
  };

  performance: {
    costToServiceTYD: number;
  };

  pmSummary: {
    compliancePercent: number;          // 0–100
    dueThisYear: number;
    completedThisYear: number;
    overdue: number;
  };

  parts: {
    totalUsed: number;
    totalPartCost: number;
    topParts?: Array<{ partNumber?: string; description?: string; qty: number; cost: number }>;
  };

  risk: {
    score: number;          // 0–100
    label: "Good" | "Watch" | "At Risk";
    reasons: string[];
  };

  workOrdersList: Array<{
    _id: string;
    type?: string;
    status?: string;
    createdAt: string;
    assetId?: string;
    workOrderNumber?: number;
  }>;

  assetCosts?: AssetCost[];
};
