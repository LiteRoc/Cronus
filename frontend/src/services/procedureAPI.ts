import axios from "axios";
import { Procedure } from "../types/types";

const API = axios.create({
  baseURL: "http://localhost:4000/", // Backend API URL
  headers: {
    "Content-Type": "application/json",
  },
});

export const getProcedures = async (): Promise<Procedure[]> => {
  const response = await API.get<Procedure[]>("/procedures");
  return response.data;
};

export const addProcedure = async (
  workOrderId: string,
  procedureId: string
): Promise<Procedure> => {
  const response = await API.patch(`/workorders/${workOrderId}/procedure`, { procedureId });
  return response.data;
};

export const deleteProcedure = async (workOrderId: string, procedureId: string) => API.delete(`/workorders/${workOrderId}/procedure/${procedureId}`)

export default API;
