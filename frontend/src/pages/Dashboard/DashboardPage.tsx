import React from "react";
import Charts from "./charts/Charts";
import { useDashboardSummaries } from "../../hooks/useDashboardSummaries";
import { useUser } from "../../context/UserContext";

const DashboardPage: React.FC = () => {
  const { user } = useUser();

  const {
    workOrdersSummary,
    assetSummary,
    partsSummary,
    technicianPerformance,
    isLoading,
    error,
  } = useDashboardSummaries();

  const isCustomer = user?.role === 'customer';

  if (!user?.role || isLoading) {
    return <div>Loading dashboard...</div>;
  }

  if (error) {
    return <div>Error loading dashboard data.</div>;
  }

  return (
    <div className="flex min-h-screen">

      {/* Main Content */}
      <main className="flex-1 p-6 bg-gray-100">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>

        <Charts
          isCustomer = {isCustomer}
          workOrdersSummary={workOrdersSummary || { open: 0, closed: 0, overdue: 0 }}
          assetSummary={assetSummary || { active: 0, inactive: 0, upcomingMaintenance: 0 }}
          partsSummary={partsSummary || { inStock: 0, lowStock: 0 }}
          technicianPerformance={technicianPerformance || []}
        />
      </main>
    </div>
  );
};

export default DashboardPage;