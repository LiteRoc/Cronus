import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFacility } from "../context/FacilityContext";

interface RouteMapping {
  match: (path: string) => boolean;
  redirectTo: string;
}

const routeMappings: RouteMapping[] = [
  {
    match: (path) => path.startsWith("/assets/edit/"),
    redirectTo: "/assets",
  },
  {
    match: (path) => path.startsWith("/workorders/edit/"),
    redirectTo: "/workorders",
  },
  {
    match: (path) => path.startsWith("/templates/edit/"),
    redirectTo: "/templates",
  },
  {
    match: (path) => path.startsWith("/parts/edit/"),
    redirectTo: "/parts",
  },
  {
    match: () => true,
    redirectTo: "/dashboard",
  },
];

export function useRedirectOnFacilityChange() {
  const { selectedFacilityId } = useFacility();
  const location = useLocation();
  const navigate = useNavigate();
  const previousFacilityRef = useRef<string | null>(selectedFacilityId);

  useEffect(() => {
    if (
      previousFacilityRef.current &&
      selectedFacilityId &&
      previousFacilityRef.current !== selectedFacilityId
    ) {
      for (const { match, redirectTo } of routeMappings) {
        if (match(location.pathname)) {
          navigate(redirectTo);
          break;
        }
      }
    }

    // Update previousFacilityId for next time
    previousFacilityRef.current = selectedFacilityId;
  }, [selectedFacilityId, location.pathname, navigate]);
}