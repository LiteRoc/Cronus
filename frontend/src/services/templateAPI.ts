import { EquipmentTemplate, TemplateLifecycleSummaryResponse, TemplateListResponse } from "@/types";
import apiClient from "./apiClient";
import { templateBusinessPayload } from './templatePolicy';

export interface TemplateMutationResponse {
  template: EquipmentTemplate;
  duplicateOf?: string | null;
  warning?: string;
  matchedOn?: string[];
}

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

export const getTemplateLifecycle = async (id: string): Promise<TemplateLifecycleSummaryResponse> => {
  const response = await apiClient.get<TemplateLifecycleSummaryResponse>(`/templates/${id}/lifecycle`);
  return response.data;
};

export const getManufactures = async () => 
  (await apiClient.get<string[]>('/templates/distinct/manufacturers')).data;

export const syncTemplate = async (id: string, diOrudi: string): Promise<TemplateMutationResponse> =>
  (await apiClient.patch(`/templates/${id}/sync-gudid`, { udi: diOrudi })).data;

export const archiveTemplate = async (id: string) =>
  (await apiClient.patch(`/templates/${id}/archive`, {})).data;

// Keep exported caller compatibility; no Template hard-delete workflow exists.
export const deleteTemplate = archiveTemplate;

// Create Template w/ Duplicate detection
/*export async function createTemplate(payload: Partial<EquipmentTemplate>): Promise<WithDuplicate<EquipmentTemplate>> {
  const { data } = await apiClient.post("/templates", payload);
  return data;
}*/

export const createTemplate = async (payload: Partial<EquipmentTemplate>): Promise<TemplateMutationResponse> =>
  (await apiClient.post('/templates', templateBusinessPayload(payload))).data;

export const createAssetFromUDI = async (payload: any) =>
  (await apiClient.post('/templates/from-di-or-udi', payload)).data;

export const createTempleteFromDI = async (di: string) =>
  (await apiClient.post('/templates/from-di', { di })).data;

// Update Template w/ Duplicate detection
export async function updateTemplate(id: string, payload: Partial<EquipmentTemplate>): Promise<TemplateMutationResponse> {
  const { data } = await apiClient.put(`/templates/${id}`, templateBusinessPayload(payload));
  return data;
}

/*export const updateTemplate = async (id: string, updatedTemplate: Partial<EquipmentTemplate>) =>
  (await apiClient.put(`/templates/${id}`, updatedTemplate));*/
