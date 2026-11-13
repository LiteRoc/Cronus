import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  archiveInteraction,
  createInteraction,
  getInteraction,
  getInteractions,
  updateInteraction,
} from "@/services/interactionAPI";

import { getContact, getContacts } from "@/services/contactAPI";

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
  archiveInteraction: vi.fn(),
}));

vi.mock("@/services/contactAPI", () => ({
  getContact: vi.fn(),
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

const validScopedContact = {
  _id: "contact-a",
  organizationId: "organization-1",
  primaryFacilityId: "facility-a",
  facilityIds: ["facility-a"],
  firstName: "Avery",
  lastName: "Morgan",
  title: "Clinical Director",
  functionalDescription: "Clinical operations",
  email: "avery@example.test",
  phone: "",
  notes: "",
  status: "active" as const,
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
  archivedAt: null,
  archivedBy: null,
};

beforeEach(() => {
  vi.mocked(getInteractions).mockReset();
  vi.mocked(getInteraction).mockReset();
  vi.mocked(createInteraction).mockReset();
  vi.mocked(updateInteraction).mockReset();
  vi.mocked(archiveInteraction).mockReset();
  vi.mocked(getContacts).mockReset();
  vi.mocked(getContact).mockReset();
  vi.mocked(getContact).mockResolvedValue(validScopedContact);

  vi.mocked(createInteraction).mockResolvedValue(interaction);
  vi.mocked(updateInteraction).mockResolvedValue(interaction);
  vi.mocked(archiveInteraction).mockResolvedValue({
    ...interaction,
    archivedAt: "2026-08-26T12:00:00.000Z",
    archivedBy: "user-1",
  });

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

test("administrator can open and cancel Interaction archive confirmation", async () => {
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
      name: "Archive Interaction",
    }),
  );

  expect(
    screen.getByText("Archive Interaction?"),
  ).toBeInTheDocument();

  expect(
    screen.getByText(
      /This Interaction will be removed from active activity/,
    ),
  ).toBeInTheDocument();

  expect(archiveInteraction).not.toHaveBeenCalled();

  fireEvent.click(
    screen.getByRole("button", {
      name: "Cancel",
    }),
  );

  expect(
    screen.queryByText("Archive Interaction?"),
  ).not.toBeInTheDocument();

  expect(archiveInteraction).not.toHaveBeenCalled();

  // Cancelling preserves the existing detail selection.
  expect(
    screen.getByText("Reviewed contract renewal options."),
  ).toBeInTheDocument();
});

test("successful Interaction archive refreshes active history and clears details", async () => {
  const archivedInteraction: Interaction = {
    ...interaction,
    archivedAt: "2026-08-26T12:00:00.000Z",
    archivedBy: "user-1",
  };

  let archiveCompleted = false;

  vi.mocked(getInteractions).mockImplementation(async () => {
    return archiveCompleted
      ? listResponse([])
      : listResponse([interaction]);
  });

  vi.mocked(getInteraction).mockResolvedValue(interaction);

  vi.mocked(archiveInteraction).mockImplementation(async () => {
    archiveCompleted = true;
    return archivedInteraction;
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
      name: "Archive Interaction",
    }),
  );

  expect(archiveInteraction).not.toHaveBeenCalled();

  fireEvent.click(
    screen.getByRole("button", {
      name: "Confirm Archive",
    }),
  );

  await waitFor(() => {
    expect(archiveInteraction).toHaveBeenCalledWith(
      "facility-a",
      "interaction-1",
    );
  });

  expect(archiveInteraction).toHaveBeenCalledTimes(1);

  // Confirm that the active list is refreshed after archiving.
  await waitFor(() => {
    expect(getInteractions).toHaveBeenCalledTimes(2);
  });

  // The backend's empty active list is authoritative.
  expect(
    await screen.findByText("No Interactions found."),
  ).toBeInTheDocument();

  // The archived record must not remain selected.
  expect(
    screen.queryByText("Reviewed contract renewal options."),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByRole("button", {
      name: /Service agreement discussion/,
    }),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByRole("button", {
      name: "Archive Interaction",
    }),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Archive Interaction?"),
  ).not.toBeInTheDocument();
});

test("technician cannot access Interaction archive action", async () => {
  const operationalInteraction: Interaction = {
    ...interaction,
    visibility: "operational",
  };

  vi.mocked(getInteractions).mockResolvedValue(
    listResponse([operationalInteraction]),
  );

  vi.mocked(getInteraction).mockResolvedValue(
    operationalInteraction,
  );

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin={false}
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

  // Technicians retain their existing Edit capability.
  expect(
    screen.getByRole("button", {
      name: "Edit Interaction",
    }),
  ).toBeInTheDocument();

  // Archive is an administrator-only action.
  expect(
    screen.queryByRole("button", {
      name: "Archive Interaction",
    }),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByRole("button", {
      name: "Confirm Archive",
    }),
  ).not.toBeInTheDocument();

  expect(archiveInteraction).not.toHaveBeenCalled();
});

test("failed Interaction archive preserves confirmation and allows retry", async () => {
  const archivedInteraction: Interaction = {
    ...interaction,
    archivedAt: "2026-08-26T12:00:00.000Z",
    archivedBy: "user-1",
  };

  let archiveCompleted = false;

  vi.mocked(getInteractions).mockImplementation(async () =>
    archiveCompleted
      ? listResponse([])
      : listResponse([interaction]),
  );

  vi.mocked(archiveInteraction)
    .mockRejectedValueOnce(new Error("Service unavailable"))
    .mockImplementationOnce(async () => {
      archiveCompleted = true;
      return archivedInteraction;
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
      name: "Archive Interaction",
    }),
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Confirm Archive",
    }),
  );

  expect(
    await screen.findByRole("alert"),
  ).toHaveTextContent(
    "Unable to archive the Interaction. Please try again.",
  );

  // The confirmation remains open after failure.
  expect(
    screen.getByText("Archive Interaction?"),
  ).toBeInTheDocument();

  // The selected Interaction remains available.
  expect(
    screen.getByText("Reviewed contract renewal options."),
  ).toBeInTheDocument();

  expect(archiveInteraction).toHaveBeenCalledTimes(1);

  // Retry the same operation.
  fireEvent.click(
    screen.getByRole("button", {
      name: "Confirm Archive",
    }),
  );

  await waitFor(() => {
    expect(archiveInteraction).toHaveBeenCalledTimes(2);
  });

  expect(archiveInteraction).toHaveBeenLastCalledWith(
    "facility-a",
    "interaction-1",
  );

  // The successful retry refreshes the active list.
  expect(
    await screen.findByText("No Interactions found."),
  ).toBeInTheDocument();

  expect(
    screen.queryByText("Archive Interaction?"),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Reviewed contract renewal options."),
  ).not.toBeInTheDocument();
});

test("pending Interaction archive prevents duplicate PATCH requests", async () => {
  let resolveArchive:
    | ((value: Interaction) => void)
    | undefined;

  const pendingArchive = new Promise<Interaction>((resolve) => {
    resolveArchive = resolve;
  });

  const archivedInteraction: Interaction = {
    ...interaction,
    archivedAt: "2026-08-26T12:00:00.000Z",
    archivedBy: "user-1",
  };

  let archiveCompleted = false;

  vi.mocked(getInteractions).mockImplementation(async () =>
    archiveCompleted
      ? listResponse([])
      : listResponse([interaction]),
  );

  vi.mocked(archiveInteraction).mockReturnValue(pendingArchive);

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
      name: "Archive Interaction",
    }),
  );

  const confirmButton = screen.getByRole("button", {
    name: "Confirm Archive",
  });

  // Attempt to submit twice while the first request is pending.
  fireEvent.click(confirmButton);
  fireEvent.click(confirmButton);

  expect(archiveInteraction).toHaveBeenCalledTimes(1);

  expect(
    screen.getByRole("button", {
      name: "Archiving...",
    }),
  ).toBeDisabled();

  // Complete the pending archive.
  await act(async () => {
    archiveCompleted = true;
    resolveArchive?.(archivedInteraction);
    await pendingArchive;
  });

  expect(
    await screen.findByText("No Interactions found."),
  ).toBeInTheDocument();

  expect(archiveInteraction).toHaveBeenCalledTimes(1);

  expect(
    screen.queryByText("Archive Interaction?"),
  ).not.toBeInTheDocument();
});

test("pending Interaction archive cannot modify another Facility after switching", async () => {
  let resolveOldArchive:
    | ((value: Interaction) => void)
    | undefined;

  const pendingArchive = new Promise<Interaction>((resolve) => {
    resolveOldArchive = resolve;
  });

  const archivedInteraction: Interaction = {
    ...interaction,
    archivedAt: "2026-08-26T12:00:00.000Z",
    archivedBy: "user-1",
  };

  const facilityBInteraction: Interaction = {
    ...interaction,
    _id: "interaction-b",
    facilityId: "facility-b",
    summary: "Facility B meeting",
  };

  vi.mocked(getInteractions).mockImplementation(async (facilityId) => {
    return facilityId === "facility-b"
      ? listResponse([facilityBInteraction])
      : listResponse([interaction]);
  });

  vi.mocked(getInteraction).mockImplementation(async (_facilityId, interactionId) => {
    return interactionId === "interaction-b"
      ? facilityBInteraction
      : interaction;
  });

  vi.mocked(archiveInteraction).mockReturnValue(pendingArchive);

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
    screen.getByRole("button", {
      name: "Archive Interaction",
    }),
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Confirm Archive",
    }),
  );

  await waitFor(() => {
    expect(archiveInteraction).toHaveBeenCalledWith(
      "facility-a",
      "interaction-1",
    );
  });

  // Switch Facilities without remounting the component.
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

  const listRequestsBeforeCompletion =
    vi.mocked(getInteractions).mock.calls.length;

  // The old archive response arrives after Facility B has loaded.
  await act(async () => {
    resolveOldArchive?.(archivedInteraction);
    await pendingArchive;
  });

  // The old completion must not refresh Facility B.
  expect(getInteractions).toHaveBeenCalledTimes(
    listRequestsBeforeCompletion,
  );

  expect(
    screen.getByText("Facility B meeting"),
  ).toBeInTheDocument();

  expect(
    screen.queryByText("Service agreement discussion"),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Archive Interaction?"),
  ).not.toBeInTheDocument();

  expect(archiveInteraction).toHaveBeenCalledTimes(1);
});

test.each([
  [
    "mismatched Interaction ID",
    {
      ...interaction,
      _id: "unexpected-interaction",
      archivedAt: "2026-08-26T12:00:00.000Z",
      archivedBy: "user-1",
    },
  ],
  [
    "mismatched Facility ID",
    {
      ...interaction,
      facilityId: "facility-b",
      archivedAt: "2026-08-26T12:00:00.000Z",
      archivedBy: "user-1",
    },
  ],
  [
    "missing archive timestamp",
    {
      ...interaction,
      archivedAt: null,
      archivedBy: null,
    },
  ],
])(
  "unexpected archive response (%s) does not report verified success",
  async (_scenario, response) => {
    vi.mocked(archiveInteraction).mockResolvedValue(
      response as Interaction,
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
        name: /Service agreement discussion/,
      }),
    );

    expect(
      await screen.findByText("Reviewed contract renewal options."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Archive Interaction",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirm Archive",
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Unable to verify the archive result. Refresh before retrying.",
    );

    // The application must not falsely report archive success.
    expect(
      screen.getByText("Archive Interaction?"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Reviewed contract renewal options."),
    ).toBeInTheDocument();

    // No list reconciliation is triggered for an unverified response.
    expect(getInteractions).toHaveBeenCalledTimes(1);

    expect(archiveInteraction).toHaveBeenCalledTimes(1);
    expect(archiveInteraction).toHaveBeenCalledWith(
      "facility-a",
      "interaction-1",
    );
  },
);

test("pending archive does not clear a newer Interaction selection", async () => {
  let resolveArchive:
    | ((value: Interaction) => void)
    | undefined;

  const pendingArchive = new Promise<Interaction>((resolve) => {
    resolveArchive = resolve;
  });

  const archivedInteraction: Interaction = {
    ...interaction,
    archivedAt: "2026-08-26T12:00:00.000Z",
    archivedBy: "user-1",
  };

  const secondInteraction: Interaction = {
    ...interaction,
    _id: "interaction-2",
    summary: "Second vendor meeting",
    body: "Separate service discussion.",
  };

  let archiveCompleted = false;

  vi.mocked(getInteractions).mockImplementation(async () =>
    archiveCompleted
      ? listResponse([secondInteraction])
      : listResponse([interaction, secondInteraction]),
  );

  vi.mocked(getInteraction).mockImplementation(
    async (_facilityId, interactionId) =>
      interactionId === "interaction-2"
        ? secondInteraction
        : interaction,
  );

  vi.mocked(archiveInteraction).mockReturnValue(pendingArchive);

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  // Select Interaction A and begin archiving.
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
      name: "Archive Interaction",
    }),
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Confirm Archive",
    }),
  );

  await waitFor(() => {
    expect(archiveInteraction).toHaveBeenCalledTimes(1);
  });

  // Select Interaction B while the archive of A is pending.
  fireEvent.click(
    screen.getByRole("button", {
      name: /Second vendor meeting/,
    }),
  );

  expect(
    await screen.findByText("Separate service discussion."),
  ).toBeInTheDocument();

  // Complete the archive of A.
  await act(async () => {
    archiveCompleted = true;
    resolveArchive?.(archivedInteraction);
    await pendingArchive;
  });

  // The active list should refresh.
  await waitFor(() => {
    expect(getInteractions).toHaveBeenCalledTimes(2);
  });

  // Interaction B must remain selected.
  expect(
    screen.getByRole("heading", {
      name: "Second vendor meeting",
    }),
  ).toBeInTheDocument();

  expect(
    screen.getByText("Separate service discussion."),
  ).toBeInTheDocument();

  // Archived Interaction A must no longer appear.
  expect(
    screen.queryByRole("button", {
      name: /Service agreement discussion/,
    }),
  ).not.toBeInTheDocument();
});

test("archive reconciliation clears newer selection when absent from backend results", async () => {
  let resolveArchive:
    | ((value: Interaction) => void)
    | undefined;

  const pendingArchive = new Promise<Interaction>((resolve) => {
    resolveArchive = resolve;
  });

  const archivedInteraction: Interaction = {
    ...interaction,
    archivedAt: "2026-08-26T12:00:00.000Z",
    archivedBy: "user-1",
  };

  const secondInteraction: Interaction = {
    ...interaction,
    _id: "interaction-2",
    summary: "Second vendor meeting",
    body: "Separate service discussion.",
  };

  let archiveCompleted = false;

  vi.mocked(getInteractions).mockImplementation(async () =>
    archiveCompleted
      ? listResponse([])
      : listResponse([interaction, secondInteraction]),
  );

  vi.mocked(getInteraction).mockImplementation(
    async (_facilityId, interactionId) =>
      interactionId === "interaction-2"
        ? secondInteraction
        : interaction,
  );

  vi.mocked(archiveInteraction).mockReturnValue(pendingArchive);

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  // Open Interaction A.
  fireEvent.click(
    await screen.findByRole("button", {
      name: /Service agreement discussion/,
    }),
  );

  expect(
    await screen.findByText("Reviewed contract renewal options."),
  ).toBeInTheDocument();

  // Begin archiving A.
  fireEvent.click(
    screen.getByRole("button", {
      name: "Archive Interaction",
    }),
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Confirm Archive",
    }),
  );

  await waitFor(() => {
    expect(archiveInteraction).toHaveBeenCalledTimes(1);
  });

  // Select B while A's archive remains pending.
  fireEvent.click(
    screen.getByRole("button", {
      name: /Second vendor meeting/,
    }),
  );

  expect(
    await screen.findByText("Separate service discussion."),
  ).toBeInTheDocument();

  // Archive A completes, but backend no longer returns B either.
  await act(async () => {
    archiveCompleted = true;
    resolveArchive?.(archivedInteraction);
    await pendingArchive;
  });

  await waitFor(() => {
    expect(getInteractions).toHaveBeenCalledTimes(2);
  });

  expect(
    await screen.findByText("No Interactions found."),
  ).toBeInTheDocument();

  // Neither A nor B should remain selected.
  expect(
    screen.queryByRole("heading", {
      name: "Second vendor meeting",
    }),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Separate service discussion."),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Reviewed contract renewal options."),
  ).not.toBeInTheDocument();

  expect(
    screen.getByText(
      "Select an Interaction to view its details.",
    ),
  ).toBeInTheDocument();

  expect(archiveInteraction).toHaveBeenCalledTimes(1);
});

describe("Contact-scoped Interaction filtering", () => {
  test("includes the Contact ID in Facility-scoped list requests", async () => {
    render(
      <InteractionsPage
        facilityId="facility-a"
        facilityTimezone="America/New_York"
        isAdmin
        contactId="contact-1"
      />,
    );

    await waitFor(() => {
      expect(getInteractions).toHaveBeenCalledWith(
        "facility-a",
        expect.objectContaining({
          contactId: "contact-1",
          page: 1,
          limit: 20,
        }),
      );
    });

    expect(
      screen.getByText("Showing Interactions for the selected Contact."),
    ).toBeInTheDocument();
  });

  test("present but empty Contact ID never falls back to unfiltered history", async () => {
    vi.mocked(getInteractions).mockRejectedValue(
      new Error("Invalid contactId"),
    );

    render(
      <InteractionsPage
        facilityId="facility-a"
        facilityTimezone="America/New_York"
        isAdmin
        contactId=""
      />,
    );

    await waitFor(() => {
      expect(getInteractions).toHaveBeenCalledWith(
        "facility-a",
        expect.objectContaining({
          contactId: "",
        }),
      );
    });

    expect(
      await screen.findByText("Unable to load Interactions."),
    ).toBeInTheDocument();

    // The malformed Contact filter must remain active.
    expect(
      screen.getByText("Showing Interactions for the selected Contact."),
    ).toBeInTheDocument();

    expect(getInteractions).toHaveBeenCalledTimes(1);
  });
});

test("switching Contact filters discards stale Interaction list responses", async () => {
  let resolveOldList:
    | ((value: InteractionListResponse) => void)
    | undefined;

  const pendingOldList = new Promise<InteractionListResponse>(
    (resolve) => {
      resolveOldList = resolve;
    },
  );

  const contactAInteraction: Interaction = {
    ...interaction,
    contactIds: ["contact-a"],
    summary: "Contact A agreement",
  };

  const contactBInteraction: Interaction = {
    ...interaction,
    _id: "interaction-b",
    contactIds: ["contact-b"],
    summary: "Contact B agreement",
  };

  vi.mocked(getInteractions).mockImplementation(
    async (_facilityId, params) => {
      if (params?.contactId === "contact-b") {
        return listResponse([contactBInteraction]);
      }

      return pendingOldList;
    },
  );

  const { rerender } = render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-a"
    />,
  );

  expect(getInteractions).toHaveBeenCalledWith(
    "facility-a",
    expect.objectContaining({
      contactId: "contact-a",
    }),
  );

  // Change the Contact filter while A's request is unresolved.
  rerender(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-b"
    />,
  );

  expect(
    await screen.findByRole("button", {
      name: /Contact B agreement/,
    }),
  ).toBeInTheDocument();

  // Contact A's delayed response must be discarded.
  await act(async () => {
    resolveOldList?.(listResponse([contactAInteraction]));
    await pendingOldList;
  });

  expect(
    screen.getByRole("button", {
      name: /Contact B agreement/,
    }),
  ).toBeInTheDocument();

  expect(
    screen.queryByText("Contact A agreement"),
  ).not.toBeInTheDocument();

  expect(getInteractions).toHaveBeenCalledWith(
    "facility-a",
    expect.objectContaining({
      contactId: "contact-b",
    }),
  );

  expect(getInteractions).toHaveBeenCalledTimes(2);
});

test("Contact filter changes during Edit reconciliation do not restore stale selection", async () => {
  let resolveOldList:
    | ((value: InteractionListResponse) => void)
    | undefined;

  const pendingOldList = new Promise<InteractionListResponse>((resolve) => {
    resolveOldList = resolve;
  });

  const sharedInteraction: Interaction = {
    ...interaction,
    contactIds: ["contact-a", "contact-b"],
    summary: "Shared Contact meeting",
  };

  const updatedInteraction: Interaction = {
    ...sharedInteraction,
    summary: "Updated shared meeting",
  };

  let contactARequests = 0;

  vi.mocked(getInteractions).mockImplementation((_facilityId, params) => {
    if (params?.contactId === "contact-b") {
      return Promise.resolve(listResponse([updatedInteraction]));
    }

    contactARequests += 1;

    if (contactARequests === 1) {
      return Promise.resolve(listResponse([sharedInteraction]));
    }

    return pendingOldList;
  });

  vi.mocked(getInteraction).mockResolvedValue(sharedInteraction);
  vi.mocked(updateInteraction).mockResolvedValue(updatedInteraction);

  const { rerender } = render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-a"
    />,
  );

  fireEvent.click(
    await screen.findByRole("button", {
      name: /Shared Contact meeting/,
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
      target: { value: "Updated shared meeting" },
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
      { summary: "Updated shared meeting" },
    );
  });

  // Wait for the Edit-triggered Contact A reconciliation.
  await waitFor(() => {
    expect(contactARequests).toBe(2);
  });

  // Switch to Contact B while Contact A's refresh is pending.
  rerender(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-b"
    />,
  );

  expect(
    await screen.findByRole("button", {
      name: /Updated shared meeting/,
    }),
  ).toBeInTheDocument();

  // Resolve the old Contact A reconciliation after B has loaded.
  await act(async () => {
    resolveOldList?.(listResponse([updatedInteraction]));
    await pendingOldList;
  });

  // The record appears in B's list because it belongs to both Contacts,
  // but Contact A's previous detail selection must not be restored.
  expect(
    screen.getByRole("button", {
      name: /Updated shared meeting/,
    }),
  ).toBeInTheDocument();

  expect(
    screen.queryByRole("heading", {
      name: "Updated shared meeting",
    }),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Reviewed contract renewal options."),
  ).not.toBeInTheDocument();

  expect(getInteractions).toHaveBeenCalledWith(
    "facility-a",
    expect.objectContaining({
      contactId: "contact-b",
    }),
  );
});

test("creating an Interaction preserves the active Contact filter", async () => {
  const contactInteraction: Interaction = {
    ...interaction,
    contactIds: ["contact-a"],
    summary: "Contact A meeting",
  };

  const createdInteraction: Interaction = {
    ...contactInteraction,
    _id: "interaction-created",
    summary: "New Contact A discussion",
  };

  let createCompleted = false;

  vi.mocked(getInteractions).mockImplementation(
    async (_facilityId, params) => {
      if (params?.contactId !== "contact-a") {
        throw new Error("Unexpected unfiltered request");
      }

      return createCompleted
        ? listResponse([createdInteraction, contactInteraction])
        : listResponse([contactInteraction]);
    },
  );

  vi.mocked(createInteraction).mockImplementation(async () => {
    createCompleted = true;
    return createdInteraction;
  });

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-a"
    />,
  );

  expect(
    await screen.findByRole("button", {
      name: /Contact A meeting/,
    }),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", {
      name: "New Interaction",
    }),
  );

  // Contact validation must finish before the Create form opens.
  expect(await screen.findByLabelText("Interaction summary"))
    .toBeInTheDocument();

  expect(getContact).toHaveBeenCalledWith(
    "facility-a",
    "contact-a",
  );

  expect(
    screen.getByLabelText("Selected Contacts"),
  ).toBeInTheDocument();

  expect(
    screen.getByRole("button", {
      name: "Remove linked Contact 1",
    }),
  ).toBeInTheDocument();

  fireEvent.change(
    screen.getByLabelText("Interaction summary"),
    {
      target: { value: "New Contact A discussion" },
    },
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Save Interaction",
    }),
  );

  await waitFor(() => {
    expect(createInteraction).toHaveBeenCalledWith(
      "facility-a",
      expect.objectContaining({
        summary: "New Contact A discussion",
        contactIds: ["contact-a"],
      }),
    );
  });

  expect(createInteraction).toHaveBeenCalledTimes(1);

  // The Contact filter must remain active after creation.
  await waitFor(() => {
    expect(getInteractions).toHaveBeenCalledTimes(2);
  });

  for (const [, params] of vi.mocked(getInteractions).mock.calls) {
    expect(params?.contactId).toBe("contact-a");
  }

  expect(
    screen.getByText("Showing Interactions for the selected Contact."),
  ).toBeInTheDocument();

  expect(
    await screen.findByRole("button", {
      name: /New Contact A discussion/,
    }),
  ).toBeInTheDocument();
});

describe("Contact preselection validation", () => {
  test.each([
    [
      "inactive Contact",
      { status: "inactive" as const },
    ],
    [
      "archived Contact",
      {
        status: "archived" as const,
        archivedAt: "2026-08-26T12:00:00.000Z",
      },
    ],
    [
      "Contact associated with another Facility",
      {
        primaryFacilityId: "facility-b",
        facilityIds: ["facility-b"],
      },
    ],
    [
      "mismatched Contact ID",
      { _id: "unexpected-contact" },
    ],
  ])(
    "rejects %s before opening Interaction creation",
    async (_scenario, overrides) => {
      vi.mocked(getContact).mockResolvedValue({
        ...validScopedContact,
        ...overrides,
      });

      render(
        <InteractionsPage
          facilityId="facility-a"
          facilityTimezone="America/New_York"
          isAdmin
          contactId="contact-a"
        />,
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "New Interaction",
        }),
      );

      expect(
        await screen.findByRole("alert"),
      ).toHaveTextContent(
        "The selected Contact is unavailable for Interaction creation.",
      );

      expect(getContact).toHaveBeenCalledWith(
        "facility-a",
        "contact-a",
      );

      expect(
        screen.queryByLabelText("Interaction summary"),
      ).not.toBeInTheDocument();

      expect(createInteraction).not.toHaveBeenCalled();
    },
  );
});

test("switching Contact filters during validation resets Create lookup state", async () => {
  let resolveOldLookup:
    | ((value: typeof validScopedContact) => void)
    | undefined;

  const pendingLookup = new Promise<typeof validScopedContact>(
    (resolve) => {
      resolveOldLookup = resolve;
    },
  );

  const contactB = {
    ...validScopedContact,
    _id: "contact-b",
    firstName: "Jordan",
  };

  vi.mocked(getContact).mockImplementation(
    async (_facilityId, requestedContactId) => {
      if (requestedContactId === "contact-b") {
        return contactB;
      }

      return pendingLookup;
    },
  );

  vi.mocked(getInteractions).mockResolvedValue(listResponse([]));

  const { rerender } = render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-a"
    />,
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "New Interaction",
    }),
  );

  expect(
    screen.getByRole("button", {
      name: "Verifying Contact...",
    }),
  ).toBeDisabled();

  // Change Contact filters before validation completes.
  rerender(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-b"
    />,
  );

  // The new Contact must not inherit A's pending validation state.
  expect(
    screen.getByRole("button", {
      name: "New Interaction",
    }),
  ).toBeEnabled();

  expect(
    screen.queryByLabelText("Interaction summary"),
  ).not.toBeInTheDocument();

  // Resolve Contact A's old request after switching.
  await act(async () => {
    resolveOldLookup?.(validScopedContact);
    await pendingLookup;
  });

  // Stale completion must not open an old Create form.
  expect(
    screen.queryByLabelText("Interaction summary"),
  ).not.toBeInTheDocument();

  // Contact B can now be validated independently.
  fireEvent.click(
    screen.getByRole("button", {
      name: "New Interaction",
    }),
  );

  expect(
    await screen.findByLabelText("Interaction summary"),
  ).toBeInTheDocument();

  expect(getContact).toHaveBeenCalledWith(
    "facility-a",
    "contact-b",
  );

  expect(
    screen.getByRole("button", {
      name: "Remove linked Contact 1",
    }),
  ).toBeInTheDocument();
});

test("changing Contact filters closes an existing Create draft", async () => {
  vi.mocked(getInteractions).mockResolvedValue(listResponse([]));

  const contactB = {
    ...validScopedContact,
    _id: "contact-b",
    firstName: "Jordan",
  };

  vi.mocked(getContact).mockImplementation(
    async (_facilityId, requestedContactId) =>
      requestedContactId === "contact-b"
        ? contactB
        : validScopedContact,
  );

  const { rerender } = render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-a"
    />,
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "New Interaction",
    }),
  );

  expect(
    await screen.findByLabelText("Interaction summary"),
  ).toBeInTheDocument();

  expect(
    screen.getByRole("button", {
      name: "Remove linked Contact 1",
    }),
  ).toBeInTheDocument();

  // Begin a draft for Contact A.
  fireEvent.change(
    screen.getByLabelText("Interaction summary"),
    {
      target: {
        value: "Confidential Contact A discussion",
      },
    },
  );

  // Change to Contact B without closing the modal.
  rerender(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-b"
    />,
  );

  // Contact A's draft must no longer be displayed.
  expect(
    screen.queryByLabelText("Interaction summary"),
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Confidential Contact A discussion"),
  ).not.toBeInTheDocument();

  // Contact B should be able to begin a fresh Interaction.
  fireEvent.click(
    screen.getByRole("button", {
      name: "New Interaction",
    }),
  );

  expect(
    await screen.findByLabelText("Interaction summary"),
  ).toHaveValue("");

  expect(getContact).toHaveBeenCalledWith(
    "facility-a",
    "contact-b",
  );

  expect(createInteraction).not.toHaveBeenCalled();
});

test("pending Create response cannot modify another Contact context", async () => {
  let resolveOldCreate:
    | ((value: Interaction) => void)
    | undefined;

  const pendingCreate = new Promise<Interaction>((resolve) => {
    resolveOldCreate = resolve;
  });

  const contactAInteraction: Interaction = {
    ...interaction,
    contactIds: ["contact-a"],
    summary: "Contact A meeting",
  };

  const contactBInteraction: Interaction = {
    ...interaction,
    _id: "interaction-b",
    contactIds: ["contact-b"],
    summary: "Contact B meeting",
  };

  const createdInteraction: Interaction = {
    ...contactAInteraction,
    _id: "interaction-created",
    summary: "New Contact A discussion",
  };

  vi.mocked(getInteractions).mockImplementation(async (_facilityId, params) =>
    params?.contactId === "contact-b"
      ? listResponse([contactBInteraction])
      : listResponse([contactAInteraction]),
  );

  vi.mocked(getContact).mockImplementation(async (_facilityId, contactId) =>
    contactId === "contact-b"
      ? { ...validScopedContact, _id: "contact-b" }
      : validScopedContact,
  );

  vi.mocked(createInteraction).mockReturnValue(pendingCreate);

  const { rerender } = render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-a"
    />,
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "New Interaction",
    }),
  );

  const summary = await screen.findByLabelText("Interaction summary");

  fireEvent.change(summary, {
    target: { value: "New Contact A discussion" },
  });

  fireEvent.click(
    screen.getByRole("button", {
      name: "Save Interaction",
    }),
  );

  await waitFor(() => {
    expect(createInteraction).toHaveBeenCalledWith(
      "facility-a",
      expect.objectContaining({
        summary: "New Contact A discussion",
        contactIds: ["contact-a"],
      }),
    );
  });

  // Switch to Contact B while Contact A's Create request is pending.
  rerender(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-b"
    />,
  );

  expect(
    await screen.findByRole("button", {
      name: /Contact B meeting/,
    }),
  ).toBeInTheDocument();

  const listRequestsBeforeCompletion =
    vi.mocked(getInteractions).mock.calls.length;

  // Complete Contact A's original Create request.
  await act(async () => {
    resolveOldCreate?.(createdInteraction);
    await pendingCreate;
  });

  // The stale completion must not trigger another list refresh.
  expect(getInteractions).toHaveBeenCalledTimes(
    listRequestsBeforeCompletion,
  );

  expect(
    screen.getByRole("button", {
      name: /Contact B meeting/,
    }),
  ).toBeInTheDocument();

  expect(
    screen.queryByRole("button", {
      name: /New Contact A discussion/,
    }),
  ).not.toBeInTheDocument();

  expect(createInteraction).toHaveBeenCalledTimes(1);
});

test("failed Contact validation allows retry without opening an unlinked form", async () => {
  vi.mocked(getInteractions).mockResolvedValue(listResponse([]));

  vi.mocked(getContact)
    .mockRejectedValueOnce(new Error("Contact service unavailable"))
    .mockResolvedValueOnce(validScopedContact);

  render(
    <InteractionsPage
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
      contactId="contact-a"
    />,
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "New Interaction",
    }),
  );

  expect(
    await screen.findByRole("alert"),
  ).toHaveTextContent(
    "Unable to verify the selected Contact. Please try again.",
  );

  // A failed lookup must not open an unlinked Create form.
  expect(
    screen.queryByLabelText("Interaction summary"),
  ).not.toBeInTheDocument();

  expect(
    screen.getByRole("button", {
      name: "New Interaction",
    }),
  ).toBeEnabled();

  expect(getContact).toHaveBeenCalledTimes(1);

  // Retry the Contact lookup.
  fireEvent.click(
    screen.getByRole("button", {
      name: "New Interaction",
    }),
  );

  expect(
    await screen.findByLabelText("Interaction summary"),
  ).toBeInTheDocument();

  expect(getContact).toHaveBeenCalledTimes(2);

  expect(
    screen.getByRole("button", {
      name: "Remove linked Contact 1",
    }),
  ).toBeInTheDocument();

  expect(
    screen.queryByText(
      "Unable to verify the selected Contact. Please try again.",
    ),
  ).not.toBeInTheDocument();

  expect(createInteraction).not.toHaveBeenCalled();
});
