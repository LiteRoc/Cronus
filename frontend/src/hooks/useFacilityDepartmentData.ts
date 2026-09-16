//src/hooks/useFacilityDepartmentData.ts

import useSWR from "swr";
import { useFacility } from "../context/FacilityContext";
import { getDepartmentsByFacility } from "../services/departmentAPI";

export const useFacilityDepartmentData = () => {
  const { availableFacilities, selectedFacilityId } = useFacility(); // scoped list already available

  const {
    data: departments = [],
    isLoading: loadingDepartments,
  } = useSWR(selectedFacilityId ? ["departments", selectedFacilityId] : null, () =>
    getDepartmentsByFacility()
  );

  return {
    availableFacilities,
    departments,
    loadingDepartments,
  };
};