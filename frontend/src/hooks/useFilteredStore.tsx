// src/hooks/useFilteredStore.ts
import React, { createContext, useContext, useState, ReactNode } from "react";
import { Pagination } from "@/types"; 

// Aliases / small interfaces
//export type Filters = AssetFilters;

//type FiltersState = AssetFilters | Record<string, unknown>;

//type FilterSetter = (next: Partial<AssetFilters> | ((prev: AssetFilters) => AssetFilters)) => void;
type BaseFilters = Record<string, string | number | boolean | undefined | null>;

// Generic filtered-data cache (no need to extend the union)
interface FilteredData<TItem> {
  type: string;        // ✅ widened so tickets (or anything) can tag the cache
  items: TItem[];
}

// Generic context value
interface FilteredDataContextValue<TFilters extends BaseFilters, TItem> {
  // Facility selection
  selectedFacilityId: string | null;
  setSelectedFacilityId: (id: string | null) => void;

  // Filters
  filters: TFilters;
  setFilters: (filters: Partial<TFilters> | ((prev: TFilters) => TFilters)) => void;
  resetFilters: () => void;

  // Pagination
  pagination: Pagination;
  setPagination: (pagination: Partial<Pagination>) => void;

  // Filtered results cache
  filteredData: FilteredData<TItem> | null;
  applyFilter: (type: string, items: TItem[]) => void; // ✅ accepts any tag
}

// Base (untyped) context; callers will narrow via the generic hook
const FilteredDataContext = createContext<FilteredDataContextValue<any, any> | undefined>(undefined);

interface Props {
  children: ReactNode;
}

export const FilteredDataProvider: React.FC<Props> = ({ children }) => {
  // Facility state (persist in localStorage)
  const [selectedFacilityId, setSelectedFacilityIdState] = useState<string | null>(
    () => localStorage.getItem("selectedFacilityId")
  );

  const setSelectedFacilityId: (id: string | null) => void = (id: string | null) => {
    setSelectedFacilityIdState(id);
    if (id) localStorage.setItem("selectedFacilityId", id);
    else localStorage.removeItem("selectedFacilityId");
  };

  // Filters (generic; default to Filters)
  const [filters, setFiltersState] = useState<BaseFilters>({});
  // Pagination
  const [pagination, setPaginationState] = useState<Pagination>({
    page: 1,
    pageSize: 10,
  });

  const setFilters = (
    next: Partial<BaseFilters> | ((prev: BaseFilters) => BaseFilters)
    ) => {
      setFiltersState((prev) =>
        typeof next === "function" ? next(prev) : { ...prev, ...next }
      );
    // Reset pagination when filters change
    setPaginationState((prev) => ({ ...prev, page: 1 }));
  };

  const resetFilters = () => {
    setFiltersState({});
    setPaginationState((prev) => ({ ...prev, page: 1 }));
  };

  // Pagination
  const setPagination = (newPage: Partial<Pagination>) =>
    setPaginationState((prev) => ({ ...prev, ...newPage }));

  // Filtered data cache (generic)
  const [filteredData, setFilteredData] = useState<FilteredData<any> | null>(null);
  const applyFilter = (type: string, items: any[]) => setFilteredData({ type, items });

  const value: FilteredDataContextValue<any, any> = {
    selectedFacilityId,
    setSelectedFacilityId,
    filters,
    setFilters,
    resetFilters,
    pagination,
    setPagination,
    filteredData,
    applyFilter,
  };

  return <FilteredDataContext.Provider value={value}>{children}</FilteredDataContext.Provider>;
};

// ✅ Generic hook signature.
//    You supply the concrete types when you consume it (per page).
export function useFilteredStore<
  TFilters extends BaseFilters = BaseFilters,
  TItem = unknown
>(): FilteredDataContextValue<TFilters, TItem> {
  const context = useContext(FilteredDataContext);

  if (!context) {
    throw new Error("useFilteredStore must be used within a FilteredDataProvider");
  }

  return context as FilteredDataContextValue<TFilters, TItem>;
}