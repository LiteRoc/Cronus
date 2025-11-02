// src/types/Filter.ts

// Filter options available in asset/workorder lists
export interface Filters {
  manufacturer?: string;
  model?: string;
  status?: string;
  search?: string;
};

export interface Pagination {
  page: number;
  totalPages?: number;
  totalCount?: number;
  pageSize: number;
}

export type FilterStore<TFilters> = {
  filters: TFilters;
  pagination: Pagination;
  setFilters: (next: Partial<TFilters> | ((prev: TFilters) => TFilters)) => void;
  setPagination: (next: Partial<Pagination>) => void;
  reset: () => void;
};