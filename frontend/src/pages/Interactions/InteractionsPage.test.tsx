import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  getInteraction,
  getInteractions,
} from "@/services/interactionAPI";

import type {
  Interaction,
  InteractionListResponse,
} from "@/types/Interaction";

import InteractionsPage from "./InteractionsPage";

vi.mock("@/services/interactionAPI", () => ({
  getInteractions: vi.fn(),
  getInteraction: vi.fn(),
}));

const interaction: Interaction = {
  _id: "interaction-1",
  facilityId: "facility-a",
  type: "meeting",
  occurredAt: "2026-08-25T13:30:00.000Z",
  summary: "Service agreement discussion",
  body: "Reviewed contract renewal options.",
  direction: "outbound",
  visibility: "operational",
  contactIds: ["contact-1"],
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: "2026-08-25T13:30:00.000Z",
  updatedAt: "2026-08-25T13:30:00.000Z",
  archivedAt: null,
  archivedBy: null,
};

const listResponse = (
  interactions: Interaction[],
  totalPages = 1,
): InteractionListResponse => ({
  interactions,
  total: interactions.length,
  page: 1,
  limit: 20,
  totalPages,
});

beforeEach(() => {
  vi.mocked(getInteractions).mockReset();
  vi.mocked(getInteraction).mockReset();

  vi.mocked(getInteractions).mockResolvedValue(
    listResponse([interaction]),
  );

  vi.mocked(getInteraction).mockResolvedValue(interaction);
});

describe("Interactions activity page", () => {
  test("loads the selected Facility's activity history", async () => {
    render(
      <InteractionsPage facilityId="facility-a" isAdmin />,
    );

    expect(
      await screen.findByText("Service agreement discussion"),
    ).toBeInTheDocument();

    expect(getInteractions).toHaveBeenCalledWith(
      "facility-a",
      expect.objectContaining({
        page: 1,
        limit: 20,
      }),
    );
  });

  test("loads Interaction details when selected", async () => {
    render(
      <InteractionsPage facilityId="facility-a" isAdmin />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Service agreement discussion/,
      }),
    );

    expect(
      await screen.findByText("Reviewed contract renewal options."),
    ).toBeInTheDocument();

    expect(getInteraction).toHaveBeenCalledWith(
      "facility-a",
      "interaction-1",
    );
  });

  test("passes search and filters to the Facility-scoped API", async () => {
    render(
      <InteractionsPage facilityId="facility-a" isAdmin />,
    );

    await screen.findByText("Service agreement discussion");

    fireEvent.change(screen.getByLabelText("Search Interactions"), {
      target: { value: "contract renewal" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Search" }),
    );

    fireEvent.change(screen.getByLabelText("Filter by type"), {
      target: { value: "meeting" },
    });

    fireEvent.change(screen.getByLabelText("Filter by direction"), {
      target: { value: "outbound" },
    });

    await waitFor(() => {
      expect(getInteractions).toHaveBeenCalledWith(
        "facility-a",
        expect.objectContaining({
          search: "contract renewal",
          type: "meeting",
          direction: "outbound",
          page: 1,
        }),
      );
    });
  });

  test("discards an old Facility response after switching Facilities", async () => {
    let resolveOld:
      | ((value: InteractionListResponse) => void)
      | undefined;

    const oldRequest = new Promise<InteractionListResponse>(
      (resolve) => {
        resolveOld = resolve;
      },
    );

    const newInteraction: Interaction = {
      ...interaction,
      _id: "interaction-2",
      facilityId: "facility-b",
      summary: "New Facility meeting",
    };

    vi.mocked(getInteractions).mockImplementation((facilityId) => {
      if (facilityId === "facility-a") {
        return oldRequest;
      }

      return Promise.resolve(listResponse([newInteraction]));
    });

    const { rerender } = render(
      <InteractionsPage
        key="facility-a"
        facilityId="facility-a"
        isAdmin
      />,
    );

    rerender(
      <InteractionsPage
        key="facility-b"
        facilityId="facility-b"
        isAdmin
      />,
    );

    expect(
      await screen.findByText("New Facility meeting"),
    ).toBeInTheDocument();

    resolveOld?.(listResponse([interaction]));

    await waitFor(() => {
      expect(
        screen.queryByText("Service agreement discussion"),
      ).not.toBeInTheDocument();

      expect(
        screen.getByText("New Facility meeting"),
      ).toBeInTheDocument();
    });
  });

  test("technicians cannot display restricted Interaction details", async () => {
    const restricted: Interaction = {
      ...interaction,
      visibility: "restricted",
      summary: "Restricted strategy discussion",
      body: "Confidential planning details.",
    };

    vi.mocked(getInteractions).mockResolvedValue(
      listResponse([interaction]),
    );

    vi.mocked(getInteraction).mockResolvedValue(restricted);

    render(
      <InteractionsPage
        facilityId="facility-a"
        isAdmin={false}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Service agreement discussion/,
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("This Interaction is unavailable.");

    expect(
      screen.queryByText("Confidential planning details."),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("Restricted strategy discussion"),
    ).not.toBeInTheDocument();
  });
});

test("stale Interaction detail cannot appear after a Facility switch", async () => {
  let resolveOldDetail:
    | ((interaction: Interaction) => void)
    | undefined;

  const oldDetail = new Promise<Interaction>((resolve) => {
    resolveOldDetail = resolve;
  });

  const restricted: Interaction = {
    ...interaction,
    visibility: "restricted",
    summary: "Restricted contract negotiation",
    body: "Sensitive negotiation information.",
  };

  vi.mocked(getInteraction).mockReturnValue(oldDetail);

  const { rerender } = render(
    <InteractionsPage
      key="facility-a"
      facilityId="facility-a"
      isAdmin
    />,
  );

  fireEvent.click(
    await screen.findByRole("button", {
      name: /Service agreement discussion/,
    }),
  );

  rerender(
    <InteractionsPage
      key="facility-b"
      facilityId="facility-b"
      isAdmin={false}
    />,
  );

  await act(async () => {
    resolveOldDetail?.(restricted);
  });

  await waitFor(() => {
    expect(
      screen.queryByText("Sensitive negotiation information."),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("Restricted contract negotiation"),
    ).not.toBeInTheDocument();
  });
});

test("pagination loads the requested page and clears previous details", async () => {
  const secondInteraction: Interaction = {
    ...interaction,
    _id: "interaction-2",
    summary: "Second page discussion",
    body: "Second page details.",
  };

  vi.mocked(getInteractions).mockImplementation(
    async (_facilityId, params) => {
      if (params?.page === 2) {
        return {
          interactions: [secondInteraction],
          total: 21,
          page: 2,
          limit: 20,
          totalPages: 2,
        };
      }

      return {
        interactions: [interaction],
        total: 21,
        page: 1,
        limit: 20,
        totalPages: 2,
      };
    },
  );

  render(
    <InteractionsPage facilityId="facility-a" isAdmin />,
  );

  fireEvent.click(
    await screen.findByRole("button", {
      name: /Service agreement discussion/,
    }),
  );

  expect(
    await screen.findByText("Reviewed contract renewal options."),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "Next" }),
  );

  await waitFor(() => {
    expect(getInteractions).toHaveBeenCalledWith(
      "facility-a",
      expect.objectContaining({
        page: 2,
        limit: 20,
      }),
    );
  });

  expect(
    await screen.findByText("Second page discussion"),
  ).toBeInTheDocument();

  expect(
    screen.queryByText("Reviewed contract renewal options."),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Service agreement discussion"),
  ).not.toBeInTheDocument();

  expect(
    screen.getByText("Page 2 of 2"),
  ).toBeInTheDocument();
});

test("displays Interaction timestamps in the Facility timezone", async () => {
  const lateInteraction: Interaction = {
    ...interaction,
    occurredAt: "2026-08-26T02:30:00.000Z",
    summary: "Late evening meeting",
  };

  vi.mocked(getInteractions).mockResolvedValue(
    listResponse([lateInteraction]),
  );

  vi.mocked(getInteraction).mockResolvedValue(lateInteraction);

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  const activityButton = await screen.findByRole("button", {
    name: /Late evening meeting/,
  });

  expect(activityButton).toHaveTextContent(/Aug 25, 2026/);

  fireEvent.click(activityButton);

  expect(
    await screen.findByText("Reviewed contract renewal options."),
  ).toBeInTheDocument();

  expect(
    screen.getByText(/Aug 25, 2026.*10:30/),
  ).toBeInTheDocument();
});
