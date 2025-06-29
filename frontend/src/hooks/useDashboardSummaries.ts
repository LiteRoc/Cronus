import { useEffect, useState } from 'react';
import { fetchDashboardData } from '../services/dashboard';
import { WorkOrderSummary, AssetSummary, TechnicianPerformance, PartsSummary } from '../types/types';

export const useDashboardSummaries = () => {
  const [workOrdersSummary, setWorkOrdersSummary] = useState<WorkOrderSummary | null>(null);
  const [assetSummary, setAssetSummary] = useState<AssetSummary | null>(null);
  const [partsSummary, setPartsSummary] = useState<PartsSummary | null>(null);
  const [technicianPerformance, setTechnicianPerformance] = useState<TechnicianPerformance[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardData();

      setWorkOrdersSummary(data.workOrdersSummary);
      setAssetSummary(data.assetSummary);
      setPartsSummary(data.partsSummary);
      setTechnicianPerformance(data.technicianPerformance);
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setError(err.message || "Failed to fetch dashboard data.");
    } finally {
      setIsLoading(false);
    }
  };

  fetchData();
}, []);

  return {
    workOrdersSummary,
    assetSummary,
    partsSummary,
    technicianPerformance,
    isLoading,
    error
  };
};