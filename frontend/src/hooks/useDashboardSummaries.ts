import useSWR from 'swr';
import { fetchDashboardData } from '../services/dashboard';
import { useFacility } from '../context/FacilityContext';

export const useDashboardSummaries = () => {
  const { selectedFacilityId } = useFacility();
  console.log('Facility ID changed to:', selectedFacilityId);

  const { data, error, isLoading } = useSWR(
    selectedFacilityId ? ['dashboard-summary', selectedFacilityId] : null, fetchDashboardData,
    {
      dedupingInterval: 0,
      revalidateOnFocus: true,
      revalidateIfStale: true,
    }
  );

  console.log('Dashboard data returned:', data);

  return {
    workOrdersSummary: data?.workOrdersSummary ?? data?.workOrders ?? {},
    assetSummary: data?.assetSummary ?? {},
    partsSummary: data?.partsSummary ?? {},
    technicianPerformance: data?.technicianPerformance ?? [],
    isLoading,
    error,
  };
};