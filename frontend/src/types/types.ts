



export interface WorkOrderStatus {
  name: string;
  value: number;
};

export interface AssetStatus {
  name: string;
  value: number;
};

export interface TechnicianTimeLog {
  _id: string;
  totalTime: number;
};

export interface WorkOrderSummary {
  total: number;
  open: number;
  overdue: number;
};

export interface AssetSummary {
  total: number,
  upcomingMaintenance: number;
};

export interface PartsSummary {
  lowStock: number;
};

export interface TechnicianPerformance {
    name: string;
    totalHours: number;
};

export type FilteredType = "assets" | "workOrders";








