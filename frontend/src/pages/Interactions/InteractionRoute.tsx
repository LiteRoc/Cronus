import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { useFacility } from "@/context/FacilityContext";
import { useUser } from "@/context/UserContext";

import InteractionsPage from "./InteractionsPage";

export const canAccessInteractionUI = (
  role: string | null | undefined,
): boolean => role === "admin" || role === "technician";

export default function InteractionRoute({
  content,
}: {
  content?: ReactElement;
}) {
  const { user } = useUser();
  const { selectedFacilityId, availableFacilities } = useFacility();

  const facilityTimezone = availableFacilities?.find(
    (facility) => facility._id === selectedFacilityId,
  )?.timezone;

  if (!canAccessInteractionUI(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const identityKey = JSON.stringify([
    user?._id,
    user?.role,
    selectedFacilityId,
  ]);

  return content ?? (
    <InteractionsPage
      key={identityKey}
      facilityId={selectedFacilityId}
      facilityTimezone={facilityTimezone}
      isAdmin={user?.role === "admin"}
    />
  );
}