// src/hooks/useFacilityContracts.ts

import { useUser } from "@/context/UserContext";
import { useFacility } from "@/context/FacilityContext";
import { useContracts } from "@/hooks/useContracts";
import { Contract } from "@/types/Contract";

const normalizeId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj._id === "string") return obj._id;
    if (typeof obj.id === "string") return obj.id;
    if (typeof obj.$oid === "string") return obj.$oid;
  }

  return undefined;
};

/**
 * A simplified wrapper for customer-facing contract fetching.
 * Uses the same backend /contracts endpoint with facility filtering.
 */
export const useFacilityContracts = () => {
  const { user } = useUser();
  const { selectedFacilityId } = useFacility();
  const facilityId = selectedFacilityId ?? user?.facilityId;

  // Reuse existing contracts hook
  const { contracts, error, isLoading, mutate } = useContracts();

  // Filter down to just this customer's facility
  const normalizedFacilityId = normalizeId(facilityId);
  const facilityContracts = !normalizedFacilityId
    ? contracts ?? []
    : (contracts ?? []).filter(
        (c: Contract) => normalizeId(c.facilityId) === normalizedFacilityId
      );

  return {
    contracts: facilityContracts,
    isLoading,
    isError: !!error,
    mutate,
  };
};
