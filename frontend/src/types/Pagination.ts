//src/types/Pagination.ts

export interface Pagination {
  page: number;
  pageSize: number;
  totalPages?: number;
  totalCount?: number;
}