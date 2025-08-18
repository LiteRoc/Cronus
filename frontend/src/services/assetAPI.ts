import axios from "axios";
import { Asset, Procedure } from "../types/types";
import { WithDuplicate } from "../types/duplicate";
import apiClient from "./apiClient";

const API = axios.create({
  baseURL: "http://localhost:4000/", // Backend API URL
  headers: {
    "Content-Type": "application/json",
  },
});

export const fetchAssets = async (queryParams?: Record<string, string>) => {
  const query = new URLSearchParams(queryParams).toString();
  const response = await apiClient.get(`/assets?${query}`);
  return response.data;
}

export const getTestEquip = async (): Promise<Asset[]> => {
  const response = await apiClient.get<Asset[]>(`/assets/test-equipment`);
  return response.data;
}

export const getAssetTypes = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>(`/assets/types`);
  return response.data;
}

export const assetsByStatus = async (status: string): Promise<Asset[]> => {
  console.log(`Fetching assets with status: ${status}`);
  const response = await apiClient.get<{ assets: Asset[] }>(`/assets?status=${status}`);
  console.log('API Resonose:', response.data);
  return response.data.assets; // Ensure only the array is returned
};

export const getAssetById = async (id: string): Promise<Asset> => {
  try {
    const response = await apiClient.get<Asset>(`/assets/${id}`);
    return response.data
  } catch (error) {
    console.error('Error is getAssetById:', error);
    throw error;
  }
};

export async function createAsset(payload: Partial<Asset>): Promise<WithDuplicate<Asset>> {
  const { data } = await API.post("/assets", payload);
  return data; // includes duplicateOf/warning if present
}

export const addAsset = async (payload: any) => {
  const { data } = await apiClient.post('/assets', payload);
  return data; // <-- return the parsed body
}

export const fetchManufacturers = async () => {
  try {
    const response = await apiClient.get(`/assets/distinct/manufacturers`);
    return response.data;
  } catch (error) {
    console.error('Error is fetching Manufactureres', error);
    throw error;
  }
};

export const fetchModels = async (manuf: string) => {
  try {
    const response = await API.get(`assets/distinct/models?manufacturer=${manuf}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Models', error);
    throw error;
  }
}

export const fetchProcdures = async (): Promise<Procedure[]> => {
  try {
    const response = await API.get(`/procedures`);
    return response.data;
  } catch (error) {
    console.error('Error fetching procedures:', error);
    throw error;
  }
};

// Update asset
/*export const updateAsset = async (id: string, updatedAsset: Partial<Asset>) => {
  await API.put(`/assets/${id}`, updatedAsset);
};*/

// Update Asset with Duplicate detection
export async function updateAsset(id: string, payload: Partial<Asset>): Promise<WithDuplicate<Asset>> {
  const { data } = await API.put(`/assets/${id}`, payload);
  return data;
}

export default API;