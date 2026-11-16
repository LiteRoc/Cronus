export interface HistoryCost { knownSubtotal: number; total: number | null; isComplete: boolean; missingComponents: { reason: string }[] }
export interface HistoryFilters { assetId?: string; controlNumber?: string; startDate?: string; endDate?: string }
export interface HistoryRow {
  id: string; number: string | number; requested: string | null; completed: string | null; type: string; status: string; description: string;
  labor: { recorded: number; invalidEntries: number }; travel: { recorded: number; invalidEntries: number };
  serviceNotes: { workDate: string; description: string }[];
  parts: { id: string; number: string; description: string; referenceState: string; quantity: number | null; note: string }[];
  vendor: { name: string; workOrderNumber: string; laborHours: number | null; travelHours: number | null } | null;
  scopes: Record<string, HistoryCost>; components: Record<string, HistoryCost>; costState: string;
}
export interface AssetHistoryReport {
  schemaVersion: 'asset-history-v1'; generatedAt: string; filters: HistoryFilters; facility: { id: string; name: string };
  asset: { id: string; ctrlNumber: string; manufacturer: string; model: string; description: string; serialNumber: string; equipmentClass: string; status: string; isArchived: boolean;
    location: string; department: string; departmentState: string; acquisitionDate: string | null; installationDate: string | null; serviceStartDate: string | null; retirementDate: string | null;
    pmFrequency: string; lastPM: string | null; nextPM: string | null };
  summary: { workOrderCount: number; archivedCount: number; missingRequestDates: number; laborHours: number; travelHours: number; invalidTimeEntries: number; fullyPricedCount: number;
    scopes: Record<string, HistoryCost>; components: Record<string, HistoryCost> };
  rows: HistoryRow[]; notes: string[];
}
