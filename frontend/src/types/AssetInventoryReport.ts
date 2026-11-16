export interface InventoryFilters { departmentId?: string; status?: string; archive?: string; q?: string; equipmentClass?: string }
export interface InventoryRow {
  id: string; ctrlNumber: string; manufacturer: string; model: string; description: string; serialNumber: string;
  equipmentClass: string; status: string; isArchived: boolean; location: string; department: string;
  departmentState: 'unassigned' | 'unavailable' | 'resolved'; pmFrequency: string; lastPM: string | null; nextPM: string | null;
}
export interface AssetInventoryReport {
  schemaVersion: 'asset-inventory-v1'; generatedAt: string; facility: { id: string; name: string };
  filters: InventoryFilters; departments: { id: string; name: string }[]; rows: InventoryRow[]; rowCount: number;
  dataQuality: { missingSerial: number; unassignedDepartment: number; unavailableDepartment: number; missingNextPM: number };
  notes: string[];
}
