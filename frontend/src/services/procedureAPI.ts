//src/services/procedureAPI.ts

import apiClient from "./apiClient";
import { Procedure } from "@/types";

export const getProcedures = async (): Promise<Procedure[]> =>
  (await apiClient.get<Procedure[]>("/procedures")).data;

// 🔍 Get a single procedure by ID
export const getProcedureById = async (procedureId: string) => {
  const { data } = await apiClient.get<Procedure>(`/procedures/${procedureId}`);
  return data;
};

// ➕ Create a new procedure
export const createProcedure = async (payload: Partial<Procedure>) => {
  const { data } = await apiClient.post<Procedure>("/procedures", payload);
  return data;
};

// ✏️ Update an existing procedure
export const updateProcedure = async (
  procedureId: string,
  payload: Partial<Procedure>
) => {
  const { data } = await apiClient.put<Procedure>(
    `/procedures/${procedureId}`,
    payload
  );
  return data;
};

// 🗑️ Delete a procedure
export const deleteProcedure = async (procedureId: string) => {
  const { data } = await apiClient.delete(`/procedures/${procedureId}`);
  return data;
};
