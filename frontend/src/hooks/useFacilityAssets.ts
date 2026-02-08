// src/hooks/useFacilityAssets.ts

import { useUser } from "@/context/UserContext";
import { useAssets } from "@/hooks/useAssets";

/**
 * A simplified wrapper for customer-facing asset fetching.
 * Uses the same backend /assets endpoint with facility filtering.
 */
export const useFacilityAssets = () => {
  const { user } = useUser();
  const facilityId = user?.facilityId;

  // Reuse your existing useAssets logic
  const { assets, error, isLoading, refresh, pagination } = useAssets();

  // Filter down to just this customer's facility
  const facilityAssets = assets?.filter(
    (a) => a.facilityId === facilityId
  ) || [];

  return {
    assets: facilityAssets,
    isLoading,
    isError: !!error,
    refresh,
    pagination,
  };
};
