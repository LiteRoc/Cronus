// src/pages/ListWorkOrders/hooks/useAssetsLite.ts

import useSWR from "swr";
import { fetchAssets } from "@/services";
import { useFacility } from "@/context/FacilityContext";
import { Asset, AssetFilters, AssetListResponse } from "@/types";

export function useAssetsLite(filters: AssetFilters, page: number, pageSize: number) {
  const { selectedFacilityId } = useFacility();

  const { data, error, isLoading, mutate, isValidating } = useSWR<AssetListResponse>(
    ["assets-lite", selectedFacilityId || "none", filters, page, pageSize],
    ([, fid, f, p, size]) =>
      fetchAssets(fid === "none" ? null : (fid as string), f as AssetFilters, p as number, size as number),
    { revalidateOnFocus: false }
  );

  return {
    assets: (data?.assets ?? []) as Asset[],
    totalPages: data?.totalPages ?? 1,
    totalCount: data?.totalAssets ?? 0,
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}