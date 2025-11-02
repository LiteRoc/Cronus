// src/hooks/useAssetFilters.ts
import { useFilteredStore } from "../../../hooks/useFilteredStore";

export const useAssetFilters = () => {
  const { filters, setFilters, resetFilters } = useFilteredStore();
  return { filters, setFilters, resetFilters };
};