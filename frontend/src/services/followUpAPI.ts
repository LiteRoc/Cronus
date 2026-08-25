import apiClient from "./apiClient";
import type { FollowUp, FollowUpAssignee, FollowUpInput, FollowUpListParams, FollowUpListResponse } from "@/types/FollowUp";

const headers = (facilityId: string) => ({ "x-facility-id": facilityId });

export async function getFollowUps(facilityId: string, params: FollowUpListParams = {}): Promise<FollowUpListResponse> {
  return (await apiClient.get<FollowUpListResponse>("/followups", { params, headers: headers(facilityId) })).data;
}
export async function getFollowUp(facilityId: string, id: string): Promise<FollowUp> {
  return (await apiClient.get<{ followUp: FollowUp }>(`/followups/${id}`, { headers: headers(facilityId) })).data.followUp;
}
export async function createFollowUp(facilityId: string, input: FollowUpInput): Promise<FollowUp> {
  return (await apiClient.post<{ followUp: FollowUp }>("/followups", input, { headers: headers(facilityId) })).data.followUp;
}
export async function updateFollowUp(facilityId: string, id: string, input: Partial<FollowUpInput>): Promise<FollowUp> {
  return (await apiClient.patch<{ followUp: FollowUp }>(`/followups/${id}`, input, { headers: headers(facilityId) })).data.followUp;
}
async function action(facilityId: string, id: string, name: "complete" | "cancel" | "archive"): Promise<FollowUp> {
  return (await apiClient.patch<{ followUp: FollowUp }>(`/followups/${id}/${name}`, {}, { headers: headers(facilityId) })).data.followUp;
}
export const completeFollowUp = (facilityId: string, id: string) => action(facilityId, id, "complete");
export const cancelFollowUp = (facilityId: string, id: string) => action(facilityId, id, "cancel");
export const archiveFollowUp = (facilityId: string, id: string) => action(facilityId, id, "archive");
export async function getFollowUpAssignees(facilityId: string): Promise<FollowUpAssignee[]> {
  return (await apiClient.get<{ items: FollowUpAssignee[] }>("/followups/assignees", { headers: headers(facilityId) })).data.items;
}
