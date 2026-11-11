import apiClient from "./apiClient";

import type {
  Interaction,
  InteractionInput,
  InteractionListParams,
  InteractionListResponse,
} from "@/types/Interaction";

const headers = (facilityId: string) => ({
  "x-facility-id": facilityId,
});

export async function getInteractions(
  facilityId: string,
  params: InteractionListParams = {},
): Promise<InteractionListResponse> {
  const { data } = await apiClient.get<InteractionListResponse>(
    "/interactions",
    {
      params,
      headers: headers(facilityId),
    },
  );

  return data;
}

export async function getInteraction(
  facilityId: string,
  interactionId: string,
): Promise<Interaction> {
  const { data } = await apiClient.get<{ interaction: Interaction }>(
    `/interactions/${interactionId}`,
    {
      headers: headers(facilityId),
    },
  );

  return data.interaction;
}

export async function createInteraction(
  facilityId: string,
  input: InteractionInput,
): Promise<Interaction> {
  const { data } = await apiClient.post<{ interaction: Interaction }>(
    "/interactions",
    input,
    {
      headers: headers(facilityId),
    },
  );

  return data.interaction;
}

export async function updateInteraction(
  facilityId: string,
  interactionId: string,
  input: Partial<InteractionInput>,
): Promise<Interaction> {
  const { data } = await apiClient.patch<{ interaction: Interaction }>(
    `/interactions/${interactionId}`,
    input,
    {
      headers: headers(facilityId),
    },
  );

  return data.interaction;
}

export async function archiveInteraction(
  facilityId: string,
  interactionId: string,
): Promise<Interaction> {
  const { data } = await apiClient.patch<{ interaction: Interaction }>(
    `/interactions/${interactionId}/archive`,
    {},
    {
      headers: headers(facilityId),
    },
  );

  return data.interaction;
}
