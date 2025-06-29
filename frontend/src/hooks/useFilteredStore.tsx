import React, { createContext, useContext, useState, ReactNode } from "react";
import { Asset, WorkOrder } from "../types/types";

type FilteredType = "workOrders" | "assets";

interface FilteredData {
  type: FilteredType;
  items: WorkOrder[] | Asset[];
  totalPages?: number;
  currentPage?: number;
  totalCount?: number;
}

interface FilteredDataContextValue {
  filteredData: FilteredData | null;
  applyFilter: (
    type: FilteredType,
    items: WorkOrder[] | Asset[],
    pagination?: {
      totalPages?: number;
      currentPage?: number;
      totalCount?: number;
    }
  ) => void;
}

const FilteredDataContext = createContext<FilteredDataContextValue | undefined>(undefined);

interface Props {
  children: ReactNode;
}

export const FilteredDataProvider: React.FC<Props> = ({ children }) => {
  const [filteredData, setFilteredData] = useState<FilteredData | null>(null);

  const applyFilter: FilteredDataContextValue["applyFilter"] = (type, items, pagination = {}) => {
    setFilteredData({
      type,
      items,
      ...pagination,
    });
  };

  return (
    <FilteredDataContext.Provider value={{ filteredData, applyFilter }}>
      {children}
    </FilteredDataContext.Provider>
  );
};

export const useFilteredStore = (): FilteredDataContextValue => {
  const context = useContext(FilteredDataContext);
  if (!context) {
    throw new Error("useFilteredStore must be used within a FilteredDataProvider");
  }
  return context;
};