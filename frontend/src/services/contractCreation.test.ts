import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AxiosAdapter } from "axios";
import contractClient from "./contractClient";
import { createContract } from "./contractCreation";

const originalAdapter = contractClient.defaults.adapter;
const facilityA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const facilityB = "bbbbbbbbbbbbbbbbbbbbbbbb";
const input = {
  name: "Synthetic contract",
  type: "customer" as const,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  totalValue: 1200,
};

let sent: { url?: string; facility?: unknown; body?: unknown };
const adapter = vi.fn();

beforeEach(() => {
  localStorage.clear();
  sent = {};
  adapter.mockReset();
  adapter.mockImplementation((async config => {
    sent = {
      url: config.url,
      facility: config.headers.get("x-facility-id"),
      body: JSON.parse(config.data),
    };
    return {
      data: { contract: { _id: "C", facilityId: facilityA, status: "draft" } },
      status: 201,
      statusText: "Created",
      headers: {},
      config,
    };
  }) satisfies AxiosAdapter);
  contractClient.defaults.adapter = adapter;
});

afterEach(() => {
  contractClient.defaults.adapter = originalAdapter;
  localStorage.clear();
});

test("creates a draft request using the explicitly selected hospital", async () => {
  localStorage.setItem("selectedFacilityId", facilityB);
  const result = await createContract(facilityA, input);

  expect(sent.url).toBe("/contracts");
  expect(sent.facility).toBe(facilityA);
  expect(sent.body).toEqual(input);
  expect(result).toMatchObject({ _id: "C", status: "draft" });
});

test("rejects a missing or malformed hospital without sending a request", async () => {
  for (const id of ["", "not-an-id", "ddddddddddddddddddddddd\\d"]) {
    await expect(createContract(id, input)).rejects.toThrow("Select a hospital");
  }
  expect(adapter).not.toHaveBeenCalled();
});

test("sends only supported creation fields", async () => {
  await createContract(facilityA, {
    ...input,
    status: "active",
    facilityId: facilityB,
    amendments: [{ totalDelta: 500 }],
  } as typeof input);

  expect(sent.body).toEqual(input);
});

test("ordinary requests retain automatic hospital header injection", async () => {
  localStorage.setItem("selectedFacilityId", facilityB);
  await contractClient.post("/contracts", input);
  expect(sent.facility).toBe(facilityB);
});
