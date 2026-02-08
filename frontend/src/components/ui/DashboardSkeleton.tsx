//src/components/ui/DashboardSkeleton.tsx

export default function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Title Skeleton */}
      <div className="h-7 w-64 bg-gray-200 rounded animate-pulse"></div>

      {/* KPI Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-gray-200 shadow-sm animate-pulse"
          >
            <div className="h-5 w-24 bg-gray-200 rounded mb-4"></div>
            <div className="h-8 w-20 bg-gray-300 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}