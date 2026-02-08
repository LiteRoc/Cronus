// src/components/ui/ContractListSkeleton.tsx

export default function ContractsListSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Page Title Skeleton */}
      <div className="h-7 w-48 bg-gray-200 rounded animate-pulse"></div>

      {/* Grid of skeleton cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-gray-200 shadow-sm animate-pulse"
          >
            {/* Title bar */}
            <div className="h-5 w-32 bg-gray-300 rounded mb-4"></div>

            {/* Contract details lines */}
            <div className="space-y-3 text-sm">
              <div className="h-4 w-40 bg-gray-200 rounded"></div>
              <div className="h-4 w-52 bg-gray-200 rounded"></div>
              <div className="h-4 w-36 bg-gray-200 rounded"></div>
              <div className="h-4 w-28 bg-gray-200 rounded"></div>
            </div>

            {/* Covered assets count */}
            <div className="h-3 w-24 bg-gray-200 rounded mt-4"></div>
          </div>
        ))}
      </div>
    </div>
  );
}