import { useEffect, useState } from 'react';
import axios from 'axios';

interface WorkOrdersSummary {
  open: number;
  completed: number;
  overdue: number;
}

interface AssetSummary {
  active: number;
  inactive: number;
  upcomingMaintenance: number;
}

interface TechnicianPerformance {
  [userId: string]: {
    name: string;
    totalHours: number;
    workOrderCount: number;
  };
}

export const useDashboardSummaries = () => {
  const [workOrdersSummary, setWorkOrdersSummary] = useState<WorkOrdersSummary | null>(null);
  const [assetSummary, setAssetSummary] = useState<AssetSummary | null>(null);
  const [technicianPerformance, setTechnicianPerformance] = useState<TechnicianPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [workOrdersRes, assetsRes, techPerfRes] = await Promise.all([
          axios.get('/dashboard/workorders/summary'),
          axios.get('/dashboard/assets/summary'),
          axios.get('/dashboard/technicians/performance')
        ]);

        setWorkOrdersSummary(workOrdersRes.data);
        setAssetSummary(assetsRes.data);
        setTechnicianPerformance(techPerfRes.data);
      } catch (err: any) {
        console.error('Dashboard fetch error:', err);
        setError(err.message || 'Failed to fetch dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return {
    workOrdersSummary,
    assetSummary,
    technicianPerformance,
    isLoading,
    error
  };
};