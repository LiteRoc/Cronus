export interface ReportCost {
  knownSubtotal: number;
  total: number | null;
  isComplete: boolean;
  missingComponents: { reason?: string }[];
  workOrderCount?: number;
  fullyPricedCount?: number;
}
export interface SigmaReport {
  schemaVersion: string;
  generatedAt: string;
  contract: { id: string; name: string; number: string; facilityId: string; status: string };
  period: { startDate: string; endDate: string; timeZone: string; effectiveStart: string | null; effectiveEndExclusive: string | null };
  contractValue: number;
  costs: { scopes: Record<string, ReportCost>; components: Record<string, ReportCost> };
  activity: { total: number; closed: number; open: number; preventive: number; laborHours: number; travelHours: number };
  contribution: null;
  marginPercent: null;
  warnings: string[];
  workOrders: { id: string; number: string; assetId: string; requestDate: string; type: string; status: string; laborHours: number; travelHours: number; cost: ReportCost }[];
}
