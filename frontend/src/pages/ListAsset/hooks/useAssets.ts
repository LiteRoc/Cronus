// src/pages/ListAsset/hooks/useAssets.ts
import { useEffect } from "react";
import useSWR from "swr";
import { fetchAssets } from "@/services";
import { useFacility } from "@/context/FacilityContext";
import { useFilteredStore } from "@/hooks/useFilteredStore";

export const useAssets = () => {
  const { selectedFacilityId } = useFacility();
  const { filters, pagination, setPagination } = useFilteredStore();

  const { data, error, isLoading, mutate } = useSWR(
    ["assets", selectedFacilityId || "none", filters, pagination.page, pagination.pageSize],
    ([, fid, f, page, size]) => fetchAssets(fid, f, page, size),
    {
      dedupingInterval: 0,
      revalidateOnFocus: true,
      revalidateIfStale: true,
    }
  );

  // sync pagination back into store
  useEffect(() => {
    if (data) {
      const { currentPage, totalPages, totalAssets } = data;
      if (
        pagination.page !== currentPage ||
        pagination.totalPages !== totalPages ||
        pagination.totalCount !== totalAssets
      ) {
        setPagination({ page: currentPage, totalPages, totalCount: totalAssets });
      }
    }
  }, [data, pagination, setPagination]);

  return {
    assets: data?.assets ?? [],
    totalPages: data?.totalPages ?? 1,
    totalCount: data?.totalAssets ?? 0,
    pagination,
    setPagination,
    isLoading,
    error,
    refresh: mutate
  };
};