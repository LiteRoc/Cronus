import { Department } from "@/types";
import apiClient from "./apiClient";

/*export const getDepartmentsByFacility = async (facilityId: string) => {
  const response = await apiClient.get(`/departments/by-facility/${facilityId}`);
  return response.data;
};*/

export const getDepartmentsByFacility = async (facilityId: string) =>
(await apiClient.get<Department[]>(`/departments/by-facility/${facilityId}`)).data;
