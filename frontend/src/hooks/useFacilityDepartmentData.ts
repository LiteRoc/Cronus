//src/hooks/useFacilityDepartmentData.ts

import useSWR from "swr";
import { useFacility } from "../context/FacilityContext";
import { getDepartmentsByFacility } from "../services/departmentAPI";

export const useFacilityDepartmentData = () => {
  const { availableFacilities } = useFacility(); // scoped list already available

  const {
    data: departments = [],
    isLoading: loadingDepartments,
  } = useSWR(() => ("departments" ), () =>
    getDepartmentsByFacility()
  );

  return {
    availableFacilities,
    departments,
    loadingDepartments,
  };
};