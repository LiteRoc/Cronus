import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import apiClient from "./apiClient";
import {
  archiveFollowUp, cancelFollowUp, completeFollowUp, createFollowUp, getFollowUp,
  getFollowUpAssignees, getFollowUps, updateFollowUp,
} from "./followUpAPI";

const originalAdapter = apiClient.defaults.adapter;
let captured: InternalAxiosRequestConfig | undefined;
beforeEach(() => {
  localStorage.setItem("selectedFacilityId", "stale-facility");
  captured = undefined;
  const adapter: AxiosAdapter = async (config) => {
    captured = config;
    const data = config.url === "/followups/assignees" ? { items: [] }
      : config.url === "/followups" && config.method === "get" ? { followUps: [], total: 0, page: 1, limit: 20, totalPages: 0 }
        : { followUp: {} };
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };
  apiClient.defaults.adapter = adapter;
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; localStorage.clear(); });

describe("FollowUp API Facility headers", () => {
  test.each([
    ["list", () => getFollowUps("selected-facility")],
    ["detail", () => getFollowUp("selected-facility", "id")],
    ["create", () => createFollowUp("selected-facility", { title: "Call", dueAt: "2026-09-01T12:00:00.000Z", priority: "normal", assignedTo: "user" })],
    ["update", () => updateFollowUp("selected-facility", "id", { title: "Call again" })],
    ["complete", () => completeFollowUp("selected-facility", "id")],
    ["cancel", () => cancelFollowUp("selected-facility", "id")],
    ["archive", () => archiveFollowUp("selected-facility", "id")],
    ["assignees", () => getFollowUpAssignees("selected-facility")],
  ])("%s preserves the explicit Facility through the final adapter", async (_name, request) => {
    await request();
    expect(captured?.headers.get("x-facility-id")).toBe("selected-facility");
  });
});
