import type {
  AxiosAdapter,
  InternalAxiosRequestConfig,
} from "axios";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import apiClient from "./apiClient";

import {
  archiveInteraction,
  createInteraction,
  getInteraction,
  getInteractions,
  updateInteraction,
} from "./interactionAPI";

import type {
  Interaction,
  InteractionInput,
} from "@/types/Interaction";

const interaction: Interaction = {
  _id: "interaction-1",
  facilityId: "selected-facility",

  type: "meeting",
  occurredAt: "2026-11-09T14:00:00.000Z",
  summary: "Contract discussion",
  body: "Discussed the service agreement.",
  direction: "outbound",
  visibility: "operational",

  contactIds: ["contact-1", "contact-2"],

  createdBy: "user-1",
  updatedBy: "user-1",

  createdAt: "2026-11-09T14:00:00.000Z",
  updatedAt: "2026-11-09T14:00:00.000Z",

  archivedAt: null,
  archivedBy: null,
};

const input: InteractionInput = {
  type: "meeting",
  occurredAt: "2026-11-09T14:00:00.000Z",
  summary: "Contract discussion",
  body: "Discussed the service agreement.",
  direction: "outbound",
  visibility: "operational",
  contactIds: ["contact-1", "contact-2"],
};

const originalAdapter = apiClient.defaults.adapter;

let captured: InternalAxiosRequestConfig | undefined;

beforeEach(() => {
  captured = undefined;

  localStorage.setItem(
    "selectedFacilityId",
    "stale-local-storage-facility",
  );

  const adapter: AxiosAdapter = async (config) => {
    captured = config;

    const data =
      config.url === "/interactions" &&
      config.method === "get"
        ? {
            interactions: [interaction],
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          }
        : { interaction };

    return {
      data,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };

  apiClient.defaults.adapter = adapter;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  localStorage.clear();
});

describe("Interaction API Facility isolation", () => {
  test.each([
    [
      "list",
      () => getInteractions("selected-facility"),
    ],
    [
      "detail",
      () => getInteraction("selected-facility", "interaction-1"),
    ],
    [
      "create",
      () => createInteraction("selected-facility", input),
    ],
    [
      "update",
      () =>
        updateInteraction(
          "selected-facility",
          "interaction-1",
          { summary: "Updated discussion" },
        ),
    ],
    [
      "archive",
      () =>
        archiveInteraction(
          "selected-facility",
          "interaction-1",
        ),
    ],
  ])(
    "%s preserves explicit Facility context through Axios",
    async (_operation, request) => {
      await request();

      expect(captured).toBeDefined();

      expect(
        captured?.headers.get("x-facility-id"),
      ).toBe("selected-facility");
    },
  );
});

describe("Interaction API contract", () => {
  test("list forwards supported filters and pagination", async () => {
    const result = await getInteractions(
      "selected-facility",
      {
        search: "contract",
        type: "meeting",
        direction: "outbound",
        visibility: "operational",
        contactId: "contact-1",
        occurredFrom: "2026-11-01T00:00:00.000Z",
        occurredTo: "2026-11-09T23:59:59.000Z",
        page: 1,
        limit: 20,
      },
    );

    expect(captured?.url).toBe("/interactions");
    expect(captured?.method).toBe("get");

    expect(captured?.params).toMatchObject({
      search: "contract",
      type: "meeting",
      direction: "outbound",
      visibility: "operational",
      contactId: "contact-1",
      occurredFrom: "2026-11-01T00:00:00.000Z",
      occurredTo: "2026-11-09T23:59:59.000Z",
      page: 1,
      limit: 20,
    });

    expect(result.interactions).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  test("detail returns the Interaction response object", async () => {
    const result = await getInteraction(
      "selected-facility",
      "interaction-1",
    );

    expect(captured?.method).toBe("get");
    expect(captured?.url).toBe("/interactions/interaction-1");
    expect(result).toEqual(interaction);
  });

  test("create sends only the supplied mutable fields", async () => {
    const result = await createInteraction(
      "selected-facility",
      input,
    );

    expect(captured?.method).toBe("post");
    expect(captured?.url).toBe("/interactions");

    expect(JSON.parse(captured?.data as string)).toEqual(input);

    expect(result._id).toBe("interaction-1");
  });

  test("update uses PATCH with a partial payload", async () => {
    await updateInteraction(
      "selected-facility",
      "interaction-1",
      {
        summary: "Updated discussion",
        contactIds: ["contact-2"],
      },
    );

    expect(captured?.method).toBe("patch");
    expect(captured?.url).toBe("/interactions/interaction-1");

    expect(JSON.parse(captured?.data as string)).toEqual({
      summary: "Updated discussion",
      contactIds: ["contact-2"],
    });
  });

  test("archive uses the dedicated endpoint", async () => {
    await archiveInteraction(
      "selected-facility",
      "interaction-1",
    );

    expect(captured?.method).toBe("patch");

    expect(captured?.url).toBe(
      "/interactions/interaction-1/archive",
    );

    expect(JSON.parse(captured?.data as string)).toEqual({});
  });
});
