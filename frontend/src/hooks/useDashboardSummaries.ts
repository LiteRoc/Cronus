import useSWR from 'swr';
import { fetchDashboardData } from '../services/dashboard';

export const useDashboardSummaries = (role?: string) => {
  const dashboardFetcher = (_: string, role: string | undefined) => fetchDashboardData(role);

  const { data, error, isLoading } = useSWR(['dashboard-summary', role], dashboardFetcher);

  return {
    workOrdersSummary: data.workOrdersSummary,
    assetSummary: data.assetSummary,
    partsSummary: data.partsSummary,
    technicianPerformance: data.technicianPerformance,
    isLoading,
    error
  };
};