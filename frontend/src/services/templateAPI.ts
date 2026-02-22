import { EquipmentTemplate, TemplateLifecycleResponse, TemplateListResponse } from "@/types";
import { WithDuplicate } from "../types/duplicate";
import apiClient from "./apiClient";

export const getTemplates = async (params?: any): Promise<TemplateListResponse> =>
  (await apiClient.get<TemplateListResponse>("/templates", { params })).data;

export const getTemplateById = async (id: string): Promise<EquipmentTemplate> => {
    try {
        const response = await apiClient.get<EquipmentTemplate>(`/templates/${id}`);
        return response.data;
    } catch (err) {
        console.error("Error getting TemplateById:", err);
        throw err;
    }
};

export const getTemplateLifecycle = async (id: string): Promise<TemplateLifecycleResponse> => {
  const response = await apiClient.get<TemplateLifecycleResponse>(`/templates/${id}/lifecycle`);
  return response.data;
};

export const getManufactures = async () => 
  (await apiClient.get<string[]>('/templates/distinct/manufacturers')).data;

export const syncTemplate = async (id: string, diOrudi: string) =>
  (await apiClient.patch(`/templates/${id}/sync-gudid`, { udi: diOrudi })).data;

export const deleteTemplate = async (id: string) =>
  (await apiClient.delete(`/templates/${id}`));

// Create Template w/ Duplicate detection
/*export async function createTemplate(payload: Partial<EquipmentTemplate>): Promise<WithDuplicate<EquipmentTemplate>> {
  const { data } = await apiClient.post("/templates", payload);
  return data;
}*/

export const createTemplate = async (payload: any) =>
  (await apiClient.post('/templates', payload)).data;

export const createAssetFromUDI = async (payload: any) =>
  (await apiClient.post('/templates/from-di-or-udi', payload)).data;

export const createTempleteFromDI = async (di: string) =>
  (await apiClient.post('/templates/from-di', { di })).data;

// Update Template w/ Duplicate detection
export async function updateTemplate(id: string, payload: Partial<EquipmentTemplate>): Promise<WithDuplicate<EquipmentTemplate>> {
  const { data } = await apiClient.put(`/templates/${id}`, payload);
  return data;
}

/*export const updateTemplate = async (id: string, updatedTemplate: Partial<EquipmentTemplate>) =>
  (await apiClient.put(`/templates/${id}`, updatedTemplate));*/
