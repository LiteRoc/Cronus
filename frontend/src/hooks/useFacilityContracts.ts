// src/hooks/useFacilityContracts.ts

import { useUser } from "@/context/UserContext";
import { useContracts } from "@/hooks/useContracts";

/**
 * A simplified wrapper for customer-facing contract fetching.
 * Uses the same backend /contracts endpoint with facility filtering.
 */
export const useFacilityContracts = () => {
  const { user } = useUser();
  const facilityId = user?.facilityId;

  // Reuse existing contracts hook
  const { vendors, error, isLoading, mutate } = useContracts();

  // Filter down to just this customer's facility
  const facilityContracts =
    vendors?.filter((c) => c.facilityId === facilityId) || [];

  return {
    contracts: facilityContracts,
    isLoading,
    isError: !!error,
    mutate,
  };
};
