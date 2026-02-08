//src/services/departmentAPI.ts

import { Department } from "@/types";
import apiClient from "./apiClient";


export const getDepartmentsByFacility = async () =>
(await apiClient.get<Department[]>("/departments")).data;
