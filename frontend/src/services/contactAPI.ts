import apiClient from "./apiClient";
import type { Contact, ContactInput, ContactListResponse, ContactMutationResponse } from "@/types/Contact";

const facilityHeaders = (facilityId: string) => ({ "x-facility-id": facilityId });

export async function getContacts(
  facilityId: string,
  params: { search?: string; page?: number; limit?: number } = {},
): Promise<ContactListResponse> {
  const { data } = await apiClient.get<ContactListResponse>("/contacts", {
    params,
    headers: facilityHeaders(facilityId),
  });
  return data;
}

export async function getContact(facilityId: string, contactId: string): Promise<Contact> {
  const { data } = await apiClient.get<{ contact: Contact }>(`/contacts/${contactId}`, {
    headers: facilityHeaders(facilityId),
  });
  return data.contact;
}

export async function createContact(
  facilityId: string,
  input: ContactInput,
): Promise<ContactMutationResponse> {
  const { data } = await apiClient.post<ContactMutationResponse>("/contacts", input, {
    headers: facilityHeaders(facilityId),
  });
  return data;
}

export async function updateContact(
  facilityId: string,
  contactId: string,
  input: Partial<ContactInput>,
): Promise<ContactMutationResponse> {
  const { data } = await apiClient.patch<ContactMutationResponse>(`/contacts/${contactId}`, input, {
    headers: facilityHeaders(facilityId),
  });
  return data;
}

export async function archiveContact(facilityId: string, contactId: string): Promise<Contact> {
  const { data } = await apiClient.patch<{ contact: Contact }>(`/contacts/${contactId}/archive`, {}, {
    headers: facilityHeaders(facilityId),
  });
  return data.contact;
}
