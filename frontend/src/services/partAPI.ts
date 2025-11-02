// src/services/partAPI.ts
import apiClient from "./apiClient";
import { Part } from "@/types";

export const getParts = async () => {
  const { data } = await apiClient.get<Part[]>("/parts");
  return data;
};

export const getPartById = async (partId: string) => {
  const { data } = await apiClient.get<Part>(`/parts/${partId}`);
  return data;
};

export const createPart = async (payload: Partial<Part>) => {
  const { data } = await apiClient.post<Part>("/parts", payload);
  return data;
};

export const updatePart = async (partId: string, payload: Partial<Part>) => {
  const { data } = await apiClient.put<Part>(`/parts/${partId}`, payload);
  return data;
};

export const deletePart = async (partId: string) => {
  const { data } = await apiClient.delete(`/parts/${partId}`);
  return data;
};