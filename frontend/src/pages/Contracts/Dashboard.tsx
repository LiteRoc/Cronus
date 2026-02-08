import React from "react";
import { useNavigate } from "react-router-dom";
import { FormCard } from "@/components/ui";
import { useFacilityAssets } from "@/hooks/useFacilityAssets";
import { useFacilityContracts } from "@/hooks/useFacilityContracts";
import DashboardSkeleton from "@/components/ui/DashboardSkeleton";

const Dashboard: React.FC = () => {
  const nav = useNavigate();

  const { assets, isLoading } = useFacilityAssets();
  const { contracts, isLoading: contractsLoading } = useFacilityContracts();

  const loading = isLoading || contractsLoading;

  if (loading) {
    return <DashboardSkeleton />;
  }

  const totalAssets = assets.length;
  const totalContracts = contracts.length;

  //console.log('Customer Assets:', assets);
  //console.log('Customer Contracts:', contracts);

  const metrics = [
    { label: "Active Assets", value: isLoading ? "…" : totalAssets },
    { label: "Under Contract",
      value: isLoading ? "…" : totalContracts,
      onClick: () => nav("/contracts"),
    },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-gray-800">Welcome to Your Equipment Portal</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => (
          <div
            key={m.label}
            onClick={m.onClick}
            className="cursor-pointer hover:opacity-70 transition hover:bg-gray-50 focus:outline-none"
            aria-label={m.label}
          >
            <FormCard key={m.label} title={m.label}>
              <p className="text-3xl font-bold text-blue-600">{m.value}</p>
            </FormCard>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
