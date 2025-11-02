import useSWR from "swr";
import { useFacility } from "../context/FacilityContext";
import { getDepartmentsByFacility } from "../services/departmentAPI";

export const useFacilityDepartmentData = (facilityId?: string) => {
  const { availableFacilities } = useFacility(); // 🧠 scoped list already available

  const {
    data: departments = [],
    isLoading: loadingDepartments,
  } = useSWR(() => (facilityId ? ["departments", facilityId] : null), () =>
    getDepartmentsByFacility(facilityId!)
  );

  return {
    availableFacilities,
    departments,
    loadingDepartments,
  };
};