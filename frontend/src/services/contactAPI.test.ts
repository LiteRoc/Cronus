import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import apiClient from "./apiClient";
import { archiveContact, createContact, getContact, getContacts, updateContact } from "./contactAPI";

const contact = {
  _id: "contact-1",
  organizationId: "org-1",
  primaryFacilityId: "facility-selected",
  facilityIds: ["facility-selected"],
  firstName: "Avery",
  lastName: "Morgan",
  title: "",
  functionalDescription: "",
  email: "",
  phone: "",
  notes: "",
  status: "active" as const,
  createdBy: "user-1",
  updatedBy: "user-1",
  archivedAt: null,
  archivedBy: null,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
};

const originalAdapter = apiClient.defaults.adapter;
let captured: InternalAxiosRequestConfig | undefined;

beforeEach(() => {
  captured = undefined;
  localStorage.setItem("selectedFacilityId", "stale-local-storage-facility");
  const adapter: AxiosAdapter = async (config) => {
    captured = config;
    const data = config.url === "/contacts" && config.method === "get"
      ? { contacts: [], total: 0, page: 1, limit: 20, totalPages: 0 }
      : config.url?.endsWith("/archive")
        ? { contact }
        : config.method === "get"
          ? { contact }
          : { contact, warnings: [] };
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };
  apiClient.defaults.adapter = adapter;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  localStorage.clear();
});

describe("Contact API Facility headers", () => {
  test.each([
    ["list", () => getContacts("facility-selected")],
    ["detail", () => getContact("facility-selected", "contact-1")],
    ["create", () => createContact("facility-selected", { firstName: "Avery", lastName: "Morgan", facilityIds: ["facility-selected"] })],
    ["update", () => updateContact("facility-selected", "contact-1", { title: "Director" })],
    ["archive", () => archiveContact("facility-selected", "contact-1")],
  ])("%s sends the explicit selected Facility through the final Axios adapter", async (_operation, request) => {
    await request();
    expect(captured).toBeDefined();
    expect(captured?.headers.get("x-facility-id")).toBe("facility-selected");
  });
});
