// src/components/Pagination.tsx
import React from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  if (totalPages <= 1 && !totalCount) return null; // hide if trivial

  return (
    <div className="mt-4 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
      {/* Page navigation */}
      <div className="flex justify-between items-center gap-2">
        <button
          disabled={page <= 1}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
          {typeof totalCount === "number" && ` (${totalCount} total)`}
        </span>
        <button
          disabled={page >= totalPages}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>

      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="pageSize" className="text-sm">
          Rows per page:
        </label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="border rounded px-2 py-1"
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default Pagination;