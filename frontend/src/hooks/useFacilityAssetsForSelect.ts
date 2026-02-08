// src/hooks/useFacilityAssetsForSelect.ts

import useSWR from "swr";
import { useUser } from "@/context/UserContext";
import { fetchAssetsForSelect } from "@/services/assetAPI";

export const useFacilityAssetsForSelect = () => {
  const { user } = useUser();
  const facilityId = user?.facilityId;

  const { data, error, isLoading, mutate } = useSWR(
    facilityId ? ["assets-for-select", facilityId] : null,
    ([, fid]) => fetchAssetsForSelect(fid),
    { revalidateOnFocus: false }
  );

  return {
    assets: data ?? [],
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
};
