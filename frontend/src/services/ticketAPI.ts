// src/services/tickets.ts

import apiClient from "./apiClient";
import { Ticket, TicketFilters } from "@/types";

/** Normalized list fetch (matches useAssets shape: currentPage/totalPages/totalCount-like fields) */
export async function fetchTickets(
  facilityId: string | undefined,
  filters: TicketFilters,
  page: number,
  pageSize: number
) {
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (pageSize) params.set("limit", String(pageSize));
  Object.entries(filters || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
  });

  const { data } = await apiClient.get(`/tickets?${params.toString()}`, {
    headers: facilityId ? { "x-facility-id": facilityId } : undefined,
  });
  // backend returns: { items, total, page, totalPages }
  return {
    tickets: (data?.items ?? []) as Ticket[],
    currentPage: data?.page ?? 1,
    totalPages: data?.totalPages ?? 1,
    totalTickets: data?.total ?? 0,
  };
}

/* Optional helpers if you want a consistent service surface */
export async function createTicket(payload: {
  type: "service" | "consumable";
  subject: string;
  description?: string;
  assetId?: string;
  partId?: string;     // for consumable
  quantity?: number;   // for consumable
  priority?: Ticket["priority"];
}) {
  const { data } = await apiClient.post(`/tickets`, payload);
  return data as Ticket;
}

export async function updateTicket(id: string, patch: Partial<Ticket>) {
  const { data } = await apiClient.patch(`/tickets/${id}`, patch);
  return data as Ticket;
}

export async function approveConsumableTicket(id: string) {
  const { data } = await apiClient.post(`/tickets/${id}/approve`);
  return data;
}

export async function convertTicketToWorkOrder(id: string) {
  const { data } = await apiClient.post(`/tickets/${id}/convert`);
  return data; // { message, workOrder, ticket }
}

export async function archiveTicket(id: string) {
  const { data } = await apiClient.patch(`/tickets/${id}/archive`);
  return data;
}