// src/pages/ListWorkOrders/hooks/useWorkOrders.ts

import { useEffect } from "react";
import useSWR from "swr";
import { fetchWorkOrders } from "@/services/";
import { useFacility } from "@/context/FacilityContext";
import { useFilteredStore } from "@/hooks/useFilteredStore";
import { WorkOrder, WorkOrderFilters } from "@/types";

type DataShape = {
  workOrders: WorkOrder[];
  currentPage: number;
  totalPages: number;
  totalWorkOrders: number;
};

export const useWorkOrders = () => {
  const { selectedFacilityId } = useFacility();
  const { filters, pagination, setPagination, applyFilter } = 
    useFilteredStore<WorkOrderFilters, WorkOrder>();

  const { data, error, isLoading, isValidating, mutate } = useSWR<DataShape>(
    ["workorders", selectedFacilityId || "none", filters, pagination.page, pagination.pageSize],
    ([, fid, f, page, size]) => 
        fetchWorkOrders(
            fid === "none" ? undefined : (fid as string),
            f as WorkOrderFilters,
            page as number,
            size as number
        ),
    {
      dedupingInterval: 0,
      revalidateOnFocus: true,
      revalidateIfStale: true,
    }
  );

  // sync pagination back into store (same pattern as useAssets)
  useEffect(() => {
    if (!data) return;
    const { currentPage, totalPages, totalWorkOrders, workOrders } = data;
    
    if (
        pagination.page !== currentPage ||
        pagination.totalPages !== totalPages ||
        pagination.totalCount !== totalWorkOrders
      ) {
        setPagination({ page: currentPage, totalPages, totalCount: totalWorkOrders });
      }
    
    applyFilter("workOrders", workOrders ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return {
    workOrders: data?.workOrders ?? [],
    totalPages: data?.totalPages ?? 1,
    totalCount: data?.totalWorkOrders ?? 0,
    pagination,
    setPagination,
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}