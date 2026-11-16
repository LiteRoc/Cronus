import { createContext, useContext } from 'react';
import type { AssetInventoryReport, InventoryFilters, InventoryRow } from '../../src/types/AssetInventoryReport';
export const hospitalA = '000000000000000000000001';
export const hospitalB = '000000000000000000000002';
export const PreviewContext = createContext({ role: 'admin', facilityId: hospitalA as string | null });
export const useUser = () => ({ user: { _id: 'synthetic-preview-user', role: useContext(PreviewContext).role } });
export const useFacility = () => ({ selectedFacilityId: useContext(PreviewContext).facilityId });
export type Scenario = 'normal' | 'pages' | 'empty' | 'unavailable';
export const settings: { scenario: Scenario } = { scenario: 'normal' };
export async function getInventoryOptions(facilityId: string) {
  return [{ id: `${facilityId}-imaging`, name: 'Synthetic Imaging' }];
}
export async function getInventoryReport(facilityId: string, filters: InventoryFilters): Promise<AssetInventoryReport> {
  if (settings.scenario === 'unavailable') throw new Error('Synthetic report unavailable');
  const departments = await getInventoryOptions(facilityId);
  const base: InventoryRow = { id: '000000000000000000000010', ctrlNumber: 'SYN-001', manufacturer: 'Synthetic Medical', model: 'Pump', description: 'Invented test equipment',
    serialNumber: 'SYN-SERIAL-001', equipmentClass: 'Pump', status: 'Active', isArchived: false, department: 'Synthetic Imaging', departmentState: 'resolved', location: 'Room 1', pmFrequency: 'Yearly', lastPM: '2026-01-01T00:00:00.000Z', nextPM: '2027-01-01T00:00:00.000Z' };
  let rows: InventoryRow[] = settings.scenario === 'empty' ? [] : settings.scenario === 'pages'
    ? Array.from({ length: 60 }, (_, index) => ({ ...base, id: String(index + 100).padStart(24, '0'), ctrlNumber: `SYN-${String(index + 1).padStart(3, '0')}` }))
    : [base, { ...base, id: '000000000000000000000011', ctrlNumber: 'SYN-002', model: 'Monitor', serialNumber: '', equipmentClass: 'Monitor', department: '', departmentState: 'unassigned', location: '', pmFrequency: '', lastPM: null, nextPM: null },
      { ...base, id: '000000000000000000000012', ctrlNumber: 'SYN-003', status: 'Retired', isArchived: true }];
  rows = rows.filter(row => {
    if ((filters.archive ?? 'exclude') === 'exclude' && row.isArchived || filters.archive === 'only' && !row.isArchived) return false;
    if (filters.status && filters.status !== row.status) return false;
    if (filters.departmentId === 'unassigned' && row.departmentState !== 'unassigned') return false;
    if (filters.departmentId && filters.departmentId !== 'unassigned' && (filters.departmentId !== departments[0].id || row.departmentState !== 'resolved')) return false;
    if (filters.equipmentClass && filters.equipmentClass.trim() !== row.equipmentClass) return false;
    const search = filters.q?.trim().toLowerCase();
    return !search || [row.ctrlNumber, row.manufacturer, row.model, row.serialNumber, row.description].some(value => value.toLowerCase().includes(search));
  });
  return { schemaVersion: 'asset-inventory-v1', generatedAt: new Date().toISOString(), facility: { id: facilityId, name: facilityId === hospitalA ? 'Synthetic Hospital A' : 'Synthetic Hospital B' },
    filters: { ...filters }, departments, rows, rowCount: rows.length,
    dataQuality: { missingSerial: rows.filter(row => !row.serialNumber).length, unassignedDepartment: rows.filter(row => row.departmentState === 'unassigned').length,
      unavailableDepartment: 0, missingNextPM: rows.filter(row => !row.nextPM).length },
    notes: ['SYNTHETIC PREVIEW ONLY. All equipment, identifiers and departments are invented.', 'Current inventory only; schedule dates are recorded fields, not verified compliance.', 'No live API, sign-in, browser storage, database or scheduler is used.'],
  };
}
