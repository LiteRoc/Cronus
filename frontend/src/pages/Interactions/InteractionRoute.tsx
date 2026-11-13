import type { ReactElement } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

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
  const [urlParams, setUrlParams] = useSearchParams();

  // Preserve a present-but-invalid Contact ID so the backend
  // can reject it rather than silently loading Facility-wide data.
  const contactId = urlParams.has("contactId")
    ? (urlParams.get("contactId") ?? "")
    : null;

  const clearContactFilter = () => {
    setUrlParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("contactId");
      return next;
    });
  };

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
      contactId={contactId}
      onClearContactFilter={clearContactFilter}
    />
  );
}