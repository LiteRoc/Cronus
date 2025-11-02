import apiClient from "./apiClient";
import { Facility } from "../types/types";

// Fetch all facilities (admin see all, others see scoped facilities)
export async function getFacilities(): Promise<Facility[]> {
    const res = await apiClient.get<Facility[]>("/facilities");
    return res.data;
}

export async function createFacility(data: Partial<Facility>): Promise<Facility> {
  const res = await apiClient.post<Facility>("/facilities", data);
  return res.data;
}

export async function updateFacility(id: string, data: Partial<Facility>): Promise<Facility> {
  const res = await apiClient.put<Facility>(`/facilities/${id}`, data);
  return res.data;
}

export async function deleteFacility(id: string): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/facilities/${id}`);
  return res.data;
}