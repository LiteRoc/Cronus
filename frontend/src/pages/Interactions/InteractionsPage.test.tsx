import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  createInteraction,
  getInteraction,
  getInteractions,
  updateInteraction,
} from "@/services/interactionAPI";

import { getContacts } from "@/services/contactAPI";

import type {
  Interaction,
  InteractionListResponse,
} from "@/types/Interaction";

import InteractionsPage from "./InteractionsPage";

vi.mock("@/services/interactionAPI", () => ({
  getInteractions: vi.fn(),
  getInteraction: vi.fn(),
  createInteraction: vi.fn(),
  updateInteraction: vi.fn(),
}));

vi.mock("@/services/contactAPI", () => ({
  getContacts: vi.fn(),
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
  vi.mocked(createInteraction).mockReset();
  vi.mocked(updateInteraction).mockReset();
  vi.mocked(getContacts).mockReset();

  vi.mocked(createInteraction).mockResolvedValue(interaction);
  vi.mocked(updateInteraction).mockResolvedValue(interaction);

  vi.mocked(getContacts).mockResolvedValue({
    contacts: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

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

describe("Interaction creation workflow", () => {
  test("New Interaction opens the creation form", async () => {
    render(
      <InteractionsPage
        facilityId="facility-a"
        facilityTimezone="America/New_York"
        isAdmin
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "New Interaction" }),
    );

    expect(
      screen.getByLabelText("Interaction summary"),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Interaction date and time"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Linked Contacts"),
    ).toBeInTheDocument();

    expect(getContacts).toHaveBeenCalledWith(
      "facility-a",
      expect.any(Object),
    );
  });

  test("creating an Interaction submits to the selected Facility and refreshes history", async () => {
    render(
      <InteractionsPage
        facilityId="facility-a"
        facilityTimezone="America/New_York"
        isAdmin
      />,
    );

    await screen.findByText("Service agreement discussion");

    const callsBeforeCreate =
      vi.mocked(getInteractions).mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", { name: "New Interaction" }),
    );

    fireEvent.change(
      screen.getByLabelText("Interaction summary"),
      {
        target: { value: "New vendor meeting" },
      },
    );

    fireEvent.change(
      screen.getByLabelText("Interaction date and time"),
      {
        target: { value: "2026-08-25T09:30" },
      },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Save Interaction" }),
    );

    await waitFor(() => {
      expect(createInteraction).toHaveBeenCalledWith(
        "facility-a",
        expect.objectContaining({
          type: "note",
          summary: "New vendor meeting",
          occurredAt: "2026-08-25T13:30:00.000Z",
          visibility: "operational",
          contactIds: [],
        }),
      );
    });

    await waitFor(() => {
      expect(
        vi.mocked(getInteractions).mock.calls.length,
      ).toBeGreaterThan(callsBeforeCreate);
    });

    expect(
      screen.queryByLabelText("Interaction summary"),
    ).not.toBeInTheDocument();

    expect(createInteraction).toHaveBeenCalledTimes(1);
  });
});

test("failed creation preserves the form and allows retry", async () => {
  vi.mocked(createInteraction)
    .mockRejectedValueOnce(new Error("Service unavailable"))
    .mockResolvedValueOnce(interaction);

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  fireEvent.click(
    screen.getByRole("button", { name: "New Interaction" }),
  );

  fireEvent.change(
    screen.getByLabelText("Interaction summary"),
    {
      target: { value: "Important vendor discussion" },
    },
  );

  fireEvent.change(
    screen.getByLabelText("Interaction date and time"),
    {
      target: { value: "2026-08-25T09:30" },
    },
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Save Interaction" }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to create the Interaction",
  );

  expect(
    screen.getByLabelText("Interaction summary"),
  ).toHaveValue("Important vendor discussion");

  expect(createInteraction).toHaveBeenCalledTimes(1);

  fireEvent.click(
    screen.getByRole("button", { name: "Save Interaction" }),
  );

  await waitFor(() => {
    expect(createInteraction).toHaveBeenCalledTimes(2);
  });

  await waitFor(() => {
    expect(
      screen.queryByLabelText("Interaction summary"),
    ).not.toBeInTheDocument();
  });
});

test("pending creation prevents duplicate submissions", async () => {
  let resolveCreate:
    | ((value: Interaction) => void)
    | undefined;

  const pendingCreate = new Promise<Interaction>((resolve) => {
    resolveCreate = resolve;
  });

  vi.mocked(createInteraction).mockReturnValue(pendingCreate);

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  fireEvent.click(
    screen.getByRole("button", { name: "New Interaction" }),
  );

  fireEvent.change(
    screen.getByLabelText("Interaction summary"),
    {
      target: { value: "Vendor service discussion" },
    },
  );

  fireEvent.change(
    screen.getByLabelText("Interaction date and time"),
    {
      target: { value: "2026-08-25T09:30" },
    },
  );

  const saveButton = screen.getByRole("button", {
    name: "Save Interaction",
  });

  fireEvent.click(saveButton);
  fireEvent.click(saveButton);

  expect(createInteraction).toHaveBeenCalledTimes(1);

  // The form should remain unavailable for another submission.
  expect(saveButton).toBeDisabled();

  await act(async () => {
    resolveCreate?.(interaction);
  });

  await waitFor(() => {
    expect(
      screen.queryByLabelText("Interaction summary"),
    ).not.toBeInTheDocument();
  });

  expect(createInteraction).toHaveBeenCalledTimes(1);
});

test("creating an Interaction submits multiple selected Contact IDs", async () => {
  const contacts = [
    {
      _id: "contact-1",
      organizationId: "organization-1",
      primaryFacilityId: "facility-a",
      facilityIds: ["facility-a"],
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
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z",
    },
    {
      _id: "contact-2",
      organizationId: "organization-1",
      primaryFacilityId: "facility-a",
      facilityIds: ["facility-a"],
      firstName: "Blake",
      lastName: "Taylor",
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
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z",
    },
  ];

  vi.mocked(getContacts).mockResolvedValue({
    contacts,
    total: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  fireEvent.click(
    screen.getByRole("button", { name: "New Interaction" }),
  );

  fireEvent.click(
    await screen.findByRole("checkbox", { name: "Avery Morgan" }),
  );

  fireEvent.click(
    screen.getByRole("checkbox", { name: "Blake Taylor" }),
  );

  fireEvent.change(screen.getByLabelText("Interaction summary"), {
    target: { value: "Hospital vendor planning meeting" },
  });

  fireEvent.change(screen.getByLabelText("Interaction date and time"), {
    target: { value: "2026-08-25T09:30" },
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Save Interaction" }),
  );

  await waitFor(() => {
    expect(createInteraction).toHaveBeenCalledWith(
      "facility-a",
      expect.objectContaining({
        summary: "Hospital vendor planning meeting",
        contactIds: ["contact-1", "contact-2"],
      }),
    );
  });

  expect(createInteraction).toHaveBeenCalledTimes(1);
});

test("technician creation always submits operational visibility", async () => {
  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin={false}
    />,
  );

  fireEvent.click(
    screen.getByRole("button", { name: "New Interaction" }),
  );

  expect(screen.queryByLabelText("Visibility")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Interaction summary"), {
    target: { value: "Technician service discussion" },
  });

  fireEvent.change(screen.getByLabelText("Interaction date and time"), {
    target: { value: "2026-08-25T09:30" },
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Save Interaction" }),
  );

  await waitFor(() => {
    expect(createInteraction).toHaveBeenCalledWith(
      "facility-a",
      expect.objectContaining({
        summary: "Technician service discussion",
        visibility: "operational",
      }),
    );
  });

  expect(createInteraction).toHaveBeenCalledTimes(1);
});

test("pending creation cannot update a different Facility after switching", async () => {
  let resolveOldCreate:
    | ((value: Interaction) => void)
    | undefined;

  const pendingCreate = new Promise<Interaction>((resolve) => {
    resolveOldCreate = resolve;
  });

  const facilityBInteraction: Interaction = {
    ...interaction,
    _id: "interaction-b",
    facilityId: "facility-b",
    summary: "Facility B activity",
  };

  vi.mocked(createInteraction).mockReturnValue(pendingCreate);

  vi.mocked(getInteractions).mockImplementation(async (facilityId) => {
    if (facilityId === "facility-b") {
      return listResponse([facilityBInteraction]);
    }

    return listResponse([interaction]);
  });

  const { rerender } = render(
    <InteractionsPage
      key="facility-a"
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  fireEvent.click(
    screen.getByRole("button", { name: "New Interaction" }),
  );

  fireEvent.change(screen.getByLabelText("Interaction summary"), {
    target: { value: "Old Facility vendor meeting" },
  });

  fireEvent.change(screen.getByLabelText("Interaction date and time"), {
    target: { value: "2026-08-25T09:30" },
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Save Interaction" }),
  );

  await waitFor(() => {
    expect(createInteraction).toHaveBeenCalledTimes(1);
  });

  expect(createInteraction).toHaveBeenCalledWith(
    "facility-a",
    expect.objectContaining({
      summary: "Old Facility vendor meeting",
    }),
  );

  // Simulate the actual route's identity-keyed remount.
  rerender(
    <InteractionsPage
      key="facility-b"
      facilityId="facility-b"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  expect(
    await screen.findByText("Facility B activity"),
  ).toBeInTheDocument();

  expect(
    screen.queryByLabelText("Interaction summary"),
  ).not.toBeInTheDocument();

  const requestsBeforeOldCompletion =
    vi.mocked(getInteractions).mock.calls.length;

  // The Facility A request completes after Facility B is mounted.
  await act(async () => {
    resolveOldCreate?.(interaction);
    await pendingCreate;
  });

  // The old completion must not trigger another list request.
  expect(getInteractions).toHaveBeenCalledTimes(
    requestsBeforeOldCompletion,
  );

  expect(
    screen.getByText("Facility B activity"),
  ).toBeInTheDocument();

  expect(
    screen.queryByText("Old Facility vendor meeting"),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByLabelText("Interaction summary"),
  ).not.toBeInTheDocument();
});

test("editing a summary sends only the changed field and preserves historical Contacts", async () => {
  const historicalInteraction: Interaction = {
    ...interaction,
    occurredAt: "2026-08-25T13:30:42.500Z",
    contactIds: ["historical-contact"],
    summary: "Original vendor meeting",
  };

  const updatedInteraction: Interaction = {
    ...historicalInteraction,
    summary: "Updated vendor meeting",
  };

  vi.mocked(getInteractions).mockResolvedValue(
    listResponse([historicalInteraction]),
  );

  vi.mocked(getInteraction).mockResolvedValue(
    historicalInteraction,
  );

  vi.mocked(updateInteraction).mockResolvedValue(
    updatedInteraction,
  );

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  fireEvent.click(
    await screen.findByRole("button", {
      name: /Original vendor meeting/,
    }),
  );

  expect(
    await screen.findByText("Reviewed contract renewal options."),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", {
      name: "Edit Interaction",
    }),
  );

  expect(
    screen.getByLabelText("Interaction summary"),
  ).toHaveValue("Original vendor meeting");

  expect(
    screen.getByText("Linked Contact 1"),
  ).toBeInTheDocument();

  fireEvent.change(
    screen.getByLabelText("Interaction summary"),
    {
      target: { value: "Updated vendor meeting" },
    },
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Save Interaction",
    }),
  );

  await waitFor(() => {
    expect(updateInteraction).toHaveBeenCalledWith(
      "facility-a",
      "interaction-1",
      {
        summary: "Updated vendor meeting",
      },
    );
  });

  expect(updateInteraction).toHaveBeenCalledTimes(1);

  await waitFor(() => {
    expect(
      screen.queryByLabelText("Interaction summary"),
    ).not.toBeInTheDocument();
  });

  expect(
    screen.getByRole("heading", {
      name: "Updated vendor meeting",
    }),
  ).toBeInTheDocument();

  expect(updatedInteraction.contactIds).toEqual([
    "historical-contact",
  ]);

  expect(updatedInteraction.occurredAt).toBe(
    "2026-08-25T13:30:42.500Z",
  );
});

test("failed Interaction edit preserves changes and allows retry", async () => {
  const updatedInteraction: Interaction = {
    ...interaction,
    summary: "Updated service agreement discussion",
  };

  vi.mocked(updateInteraction)
    .mockRejectedValueOnce(new Error("Service unavailable"))
    .mockResolvedValueOnce(updatedInteraction);

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
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
    screen.getByRole("button", {
      name: "Edit Interaction",
    }),
  );

  fireEvent.change(
    screen.getByLabelText("Interaction summary"),
    {
      target: {
        value: "Updated service agreement discussion",
      },
    },
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Save Interaction",
    }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to update the Interaction",
  );

  // The modal remains open with the edited value.
  expect(
    screen.getByLabelText("Interaction summary"),
  ).toHaveValue("Updated service agreement discussion");

  expect(updateInteraction).toHaveBeenCalledTimes(1);

  // Retry without re-entering the information.
  fireEvent.click(
    screen.getByRole("button", {
      name: "Save Interaction",
    }),
  );

  await waitFor(() => {
    expect(updateInteraction).toHaveBeenCalledTimes(2);
  });

  expect(updateInteraction).toHaveBeenLastCalledWith(
    "facility-a",
    "interaction-1",
    {
      summary: "Updated service agreement discussion",
    },
  );

  // Successful retry closes the modal.
  await waitFor(() => {
    expect(
      screen.queryByLabelText("Interaction summary"),
    ).not.toBeInTheDocument();
  });

  // The detail panel displays the server-returned update.
  expect(
    screen.getByRole("heading", {
      name: "Updated service agreement discussion",
    }),
  ).toBeInTheDocument();
});

test("pending Interaction edit prevents duplicate PATCH requests", async () => {
  let resolveUpdate:
    | ((value: Interaction) => void)
    | undefined;

  const pendingUpdate = new Promise<Interaction>((resolve) => {
    resolveUpdate = resolve;
  });

  const updatedInteraction: Interaction = {
    ...interaction,
    summary: "Updated agreement discussion",
  };

  vi.mocked(updateInteraction).mockReturnValue(pendingUpdate);

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
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
    screen.getByRole("button", { name: "Edit Interaction" }),
  );

  fireEvent.change(
    screen.getByLabelText("Interaction summary"),
    {
      target: { value: "Updated agreement discussion" },
    },
  );

  const saveButton = screen.getByRole("button", {
    name: "Save Interaction",
  });

  fireEvent.click(saveButton);
  fireEvent.click(saveButton);

  expect(updateInteraction).toHaveBeenCalledTimes(1);
  expect(saveButton).toBeDisabled();

  await act(async () => {
    resolveUpdate?.(updatedInteraction);
    await pendingUpdate;
  });

  await waitFor(() => {
    expect(
      screen.queryByLabelText("Interaction summary"),
    ).not.toBeInTheDocument();
  });

  expect(updateInteraction).toHaveBeenCalledTimes(1);

  expect(
    screen.getByRole("heading", {
      name: "Updated agreement discussion",
    }),
  ).toBeInTheDocument();
});

test("pending Interaction edit cannot update a different Facility after switching", async () => {
  let resolveOldUpdate:
    | ((value: Interaction) => void)
    | undefined;

  const pendingUpdate = new Promise<Interaction>((resolve) => {
    resolveOldUpdate = resolve;
  });

  const restrictedInteraction: Interaction = {
    ...interaction,
    visibility: "restricted",
    summary: "Restricted agreement discussion",
    body: "Confidential negotiation details.",
  };

  const updatedRestricted: Interaction = {
    ...restrictedInteraction,
    summary: "Updated restricted agreement discussion",
  };

  const facilityBInteraction: Interaction = {
    ...interaction,
    _id: "interaction-b",
    facilityId: "facility-b",
    summary: "Facility B activity",
  };

  vi.mocked(getInteractions).mockImplementation(async (facilityId) => {
    if (facilityId === "facility-b") {
      return listResponse([facilityBInteraction]);
    }

    return listResponse([restrictedInteraction]);
  });

  vi.mocked(getInteraction).mockResolvedValue(
    restrictedInteraction,
  );

  vi.mocked(updateInteraction).mockReturnValue(pendingUpdate);

  const { rerender } = render(
    <InteractionsPage
      key="facility-a-admin"
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  fireEvent.click(
    await screen.findByRole("button", {
      name: /Restricted agreement discussion/,
    }),
  );

  expect(
    await screen.findByText("Confidential negotiation details."),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", {
      name: "Edit Interaction",
    }),
  );

  fireEvent.change(
    screen.getByLabelText("Interaction summary"),
    {
      target: {
        value: "Updated restricted agreement discussion",
      },
    },
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Save Interaction",
    }),
  );

  await waitFor(() => {
    expect(updateInteraction).toHaveBeenCalledWith(
      "facility-a",
      "interaction-1",
      {
        summary: "Updated restricted agreement discussion",
      },
    );
  });

  // Simulate the route remounting after Facility and role change.
  rerender(
    <InteractionsPage
      key="facility-b-technician"
      facilityId="facility-b"
      facilityTimezone="America/New_York"
      isAdmin={false}
    />,
  );

  expect(
    await screen.findByText("Facility B activity"),
  ).toBeInTheDocument();

  const listRequestsBeforeCompletion =
    vi.mocked(getInteractions).mock.calls.length;

  // Complete the previous administrator's PATCH after switching.
  await act(async () => {
    resolveOldUpdate?.(updatedRestricted);
    await pendingUpdate;
  });

  // The stale completion must not refresh the new Facility.
  expect(getInteractions).toHaveBeenCalledTimes(
    listRequestsBeforeCompletion,
  );

  expect(
    screen.getByText("Facility B activity"),
  ).toBeInTheDocument();

  expect(
    screen.queryByText("Confidential negotiation details."),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Updated restricted agreement discussion"),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByLabelText("Interaction summary"),
  ).not.toBeInTheDocument();
});

test("editing an Interaction reconciles the active filtered list", async () => {
  const updatedInteraction: Interaction = {
    ...interaction,
    type: "email",
    summary: "Updated email discussion",
  };

  let updateCompleted = false;

  vi.mocked(getInteractions).mockImplementation(async (_facilityId, params) => {
    if (updateCompleted && params?.type === "meeting") {
      return listResponse([]);
    }

    return listResponse([interaction]);
  });

  vi.mocked(getInteraction).mockResolvedValue(interaction);

  vi.mocked(updateInteraction).mockImplementation(async () => {
    updateCompleted = true;
    return updatedInteraction;
  });

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  // Display only Meetings.
  fireEvent.change(
    screen.getByLabelText("Filter by type"),
    {
      target: { value: "meeting" },
    },
  );

  await waitFor(() => {
    expect(getInteractions).toHaveBeenCalledWith(
      "facility-a",
      expect.objectContaining({
        type: "meeting",
      }),
    );
  });

  fireEvent.click(
    await screen.findByRole("button", {
      name: /Service agreement discussion/,
    }),
  );

  expect(
    await screen.findByText("Reviewed contract renewal options."),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", {
      name: "Edit Interaction",
    }),
  );

  fireEvent.change(
    screen.getByLabelText("Interaction type"),
    {
      target: { value: "email" },
    },
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Save Interaction",
    }),
  );

  await waitFor(() => {
    expect(updateInteraction).toHaveBeenCalledWith(
      "facility-a",
      "interaction-1",
      {
        type: "email",
      },
    );
  });

  // The backend must be consulted again using the active filter.
  await waitFor(() => {
    const meetingRequests = vi.mocked(getInteractions).mock.calls.filter(
      ([facilityId, params]) =>
        facilityId === "facility-a" &&
        params?.type === "meeting",
    );

    expect(meetingRequests.length).toBeGreaterThanOrEqual(2);
  });

  // The edited record no longer matches the Meetings filter.
  await waitFor(() => {
    expect(
      screen.queryByText("Service agreement discussion"),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("Updated email discussion"),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("Reviewed contract renewal options."),
    ).not.toBeInTheDocument();
  });

  expect(
    screen.getByText("No Interactions found."),
  ).toBeInTheDocument();
});

test("failed reconciliation does not display stale Interaction data", async () => {
  const updatedInteraction: Interaction = {
    ...interaction,
    summary: "Updated service discussion",
  };

  let updateCompleted = false;

  vi.mocked(getInteractions).mockImplementation(async () => {
    if (updateCompleted) {
      throw new Error("List service unavailable");
    }

    return listResponse([interaction]);
  });

  vi.mocked(getInteraction).mockResolvedValue(interaction);

  vi.mocked(updateInteraction).mockImplementation(async () => {
    updateCompleted = true;
    return updatedInteraction;
  });

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
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
    screen.getByRole("button", {
      name: "Edit Interaction",
    }),
  );

  fireEvent.change(
    screen.getByLabelText("Interaction summary"),
    {
      target: { value: "Updated service discussion" },
    },
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Save Interaction",
    }),
  );

  await waitFor(() => {
    expect(updateInteraction).toHaveBeenCalledWith(
      "facility-a",
      "interaction-1",
      {
        summary: "Updated service discussion",
      },
    );
  });

  expect(
    await screen.findByRole("alert"),
  ).toHaveTextContent("Unable to load Interactions.");

  // The previous activity list is no longer treated as current.
  expect(
    screen.queryByText("Service agreement discussion"),
  ).not.toBeInTheDocument();

  // An unverified detail selection must not survive the failed refresh.
  expect(
    screen.queryByText("Reviewed contract renewal options."),
  ).not.toBeInTheDocument();

  // The successful PATCH must not be repeated.
  expect(updateInteraction).toHaveBeenCalledTimes(1);
});

test("stale edit reconciliation cannot restore another Facility's records", async () => {
  let resolveOldList:
    | ((value: InteractionListResponse) => void)
    | undefined;

  const pendingOldList = new Promise<InteractionListResponse>(
    (resolve) => {
      resolveOldList = resolve;
    },
  );

  const updatedInteraction: Interaction = {
    ...interaction,
    summary: "Updated Facility A meeting",
  };

  const facilityBInteraction: Interaction = {
    ...interaction,
    _id: "interaction-b",
    facilityId: "facility-b",
    summary: "Facility B meeting",
  };

  let facilityARequests = 0;

  vi.mocked(getInteractions).mockImplementation((facilityId) => {
    if (facilityId === "facility-b") {
      return Promise.resolve(listResponse([facilityBInteraction]));
    }

    facilityARequests += 1;

    if (facilityARequests === 1) {
      return Promise.resolve(listResponse([interaction]));
    }

    return pendingOldList;
  });

  vi.mocked(getInteraction).mockResolvedValue(interaction);
  vi.mocked(updateInteraction).mockResolvedValue(updatedInteraction);

  const { rerender } = render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
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
    screen.getByRole("button", { name: "Edit Interaction" }),
  );

  fireEvent.change(
    screen.getByLabelText("Interaction summary"),
    {
      target: { value: "Updated Facility A meeting" },
    },
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Save Interaction" }),
  );

  await waitFor(() => {
    expect(updateInteraction).toHaveBeenCalledWith(
      "facility-a",
      "interaction-1",
      {
        summary: "Updated Facility A meeting",
      },
    );
  });

  // Wait until reconciliation has actually requested Facility A.
  await waitFor(() => {
    expect(facilityARequests).toBe(2);
  });

  // Change Facility without remounting the page component.
  rerender(
    <InteractionsPage
      facilityId="facility-b"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  expect(
    await screen.findByText("Facility B meeting"),
  ).toBeInTheDocument();

  // The old reconciliation response arrives after Facility B loads.
  await act(async () => {
    resolveOldList?.(listResponse([updatedInteraction]));
    await pendingOldList;
  });

  expect(
    screen.getByText("Facility B meeting"),
  ).toBeInTheDocument();

  expect(
    screen.queryByText("Updated Facility A meeting"),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Service agreement discussion"),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByRole("heading", {
      name: "Updated Facility A meeting",
    }),
  ).not.toBeInTheDocument();

  expect(getInteractions).toHaveBeenCalledWith(
    "facility-b",
    expect.objectContaining({
      page: 1,
    }),
  );
});

test("changing filters during edit reconciliation does not restore selection", async () => {
  let resolveOldList:
    | ((value: InteractionListResponse) => void)
    | undefined;

  const pendingOldList = new Promise<InteractionListResponse>(
    (resolve) => {
      resolveOldList = resolve;
    },
  );

  const updatedInteraction: Interaction = {
    ...interaction,
    summary: "Updated service agreement discussion",
  };

  let listRequests = 0;

  vi.mocked(getInteractions).mockImplementation((_facilityId, params) => {
    listRequests += 1;

    if (listRequests === 1) {
      return Promise.resolve(listResponse([interaction]));
    }

    if (params?.type === "email") {
      return Promise.resolve(listResponse([updatedInteraction]));
    }

    return pendingOldList;
  });

  vi.mocked(getInteraction).mockResolvedValue(interaction);
  vi.mocked(updateInteraction).mockResolvedValue(updatedInteraction);

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
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
    screen.getByRole("button", {
      name: "Edit Interaction",
    }),
  );

  fireEvent.change(
    screen.getByLabelText("Interaction summary"),
    {
      target: {
        value: "Updated service agreement discussion",
      },
    },
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Save Interaction",
    }),
  );

  // Ensure the edit-triggered refresh has started.
  await waitFor(() => {
    expect(listRequests).toBe(2);
  });

  // Navigate to a different filter while reconciliation is pending.
  fireEvent.change(
    screen.getByLabelText("Filter by type"),
    {
      target: { value: "email" },
    },
  );

  await waitFor(() => {
    expect(listRequests).toBe(3);
  });

  // The old response arrives after the new filter's response.
  await act(async () => {
    resolveOldList?.(listResponse([updatedInteraction]));
    await pendingOldList;
  });

  // Even if the new list contains the same Interaction ID,
  // changing filters must not automatically reopen its details.
  expect(
    screen.getByRole("button", {
      name: /Updated service agreement discussion/,
    }),
  ).toBeInTheDocument();

  expect(
    screen.queryByRole("heading", {
      name: "Updated service agreement discussion",
    }),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Reviewed contract renewal options."),
  ).not.toBeInTheDocument();
});
