import axios from "axios";
import { Part } from "../types/types";

const API = axios.create({
  baseURL: "http://localhost:4000/", // Backend API URL
  headers: {
    "Content-Type": "application/json",
  },
});

export const getParts = async (): Promise<Part[]> => {
  const response = await API.get<Part[]>("/parts");
  console.log('API Response:', response.data);
  return response.data;
};

export const addPartToWorkOrder = async (workOrderId: string, partId: string, quantity: number) => {
  const response = await API.patch(`/workorders/${workOrderId}/parts`, {
    partId,
    quantity,
  });
  return response.data;
};

export const editPartOnWorkOrder = async (workOrderId: string, partId: string, updates: Partial<{ quantity: number}>): Promise<void> => {
  await API.patch(`/workorders/${workOrderId}/parts/${partId}`, updates);
}

export const deletePart = async (workOrderId: string, partId: string) => API.delete(`/workorders/${workOrderId}/parts/${partId}`);

export default API;