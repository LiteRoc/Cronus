import { Asset, AssetLifecycleResponse, Procedure } from "../types";
import { WithDuplicate } from "../types/duplicate";
import apiClient from "./apiClient";

// Define filters shape (same as in useFilteredStore)
interface AssetFilters {
  manufacturer?: string;
  model?: string;
  status?: string;
  search?: string;
}

// Response shape returned by backend
interface AssetListResponse {
  assets: Asset[];
  totalPages: number;
  currentPage: number;
  totalAssets: number;
}

/**
 * Fetch paginated assets with optional filters and facilityId
 */
export const fetchAssets = async (
  facilityId: string | null,
  filters: AssetFilters,
  page: number = 1,
  limit: number = 10 // now dynamic
): Promise<AssetListResponse> => {
  const params: Record<string, any> = {
    page,
    limit,          // pass pageSize dynamicall
    ...filters,
  };

  if (facilityId) {
    params.facilityId = facilityId;
  }

  const response = await apiClient.get<AssetListResponse>("/assets", { params });
  return response.data;
};

export const fetchAssetsForSelect = async (facilityId?: string | null): Promise<Asset[]> => {
  const { data } = await apiClient.get<AssetListResponse>("/assets", {
    params: {
      facilityId: facilityId || undefined,
      page: 1,
      limit: 100, // fetch a large number for select dropdown
    },
  });
  return data.assets ?? [];
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

export const getAssetLifecycle = async (id: string): Promise<AssetLifecycleResponse> => {
  const response = await apiClient.get<AssetLifecycleResponse>(`/assets/${id}/lifecycle`);
  return response.data;
};

export async function createAsset(payload: Partial<Asset>): Promise<WithDuplicate<Asset>> {
  const { data } = await apiClient.post("/assets", payload);
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
    const response = await apiClient.get(`assets/distinct/models?manufacturer=${manuf}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Models', error);
    throw error;
  }
}

export const fetchProcdures = async (): Promise<Procedure[]> => {
  try {
    const response = await apiClient.get(`/procedures`);
    return response.data;
  } catch (error) {
    console.error('Error fetching procedures:', error);
    throw error;
  }
};

// Update asset
/*export const updateAsset = async (id: string, updatedAsset: Partial<Asset>) => {
  await apiClient.put(`/assets/${id}`, updatedAsset);
};*/

// Update Asset with Duplicate detection
export async function updateAsset(id: string, payload: Partial<Asset>): Promise<WithDuplicate<Asset>> {
  const { data } = await apiClient.put(`/assets/${id}`, payload);
  return data;
}

export default apiClient;
