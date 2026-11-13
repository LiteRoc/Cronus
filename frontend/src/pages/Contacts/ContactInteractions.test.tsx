import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getInteractions } from "@/services/interactionAPI";
import type {
  Interaction,
  InteractionListResponse,
} from "@/types/Interaction";
import ContactInteractions from "./ContactInteractions";

vi.mock("@/services/interactionAPI", () => ({
  getInteractions: vi.fn(),
}));

const LocationProbe = () => {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}{location.search}
    </div>
  );
};

const TestRouter = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    {children}
    <LocationProbe />
  </MemoryRouter>
);

const renderWithRouter = (ui: React.ReactElement) =>
  render(ui, { wrapper: TestRouter });

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
): InteractionListResponse => ({
  interactions,
  total: interactions.length,
  page: 1,
  limit: 5,
  totalPages: interactions.length ? 1 : 0,
});

beforeEach(() => {
  vi.mocked(getInteractions).mockReset();
  vi.mocked(getInteractions).mockResolvedValue(
    listResponse([interaction]),
  );
});

describe("Contact Interaction History", () => {
  test("requests five recent Interactions scoped to Contact and Facility", async () => {
    renderWithRouter(
      <ContactInteractions
        contactId="contact-1"
        facilityId="facility-a"
        facilityTimezone="America/New_York"
        isAdmin
      />,
    );

    expect(
      await screen.findByText("Service agreement discussion"),
    ).toBeInTheDocument();

    expect(getInteractions).toHaveBeenCalledWith(
      "facility-a",
      {
        contactId: "contact-1",
        page: 1,
        limit: 5,
      },
    );

    expect(getInteractions).toHaveBeenCalledTimes(1);
  });

  test("displays Interaction summary, type, and Facility-local date", async () => {
    renderWithRouter(
      <ContactInteractions
        contactId="contact-1"
        facilityId="facility-a"
        facilityTimezone="America/New_York"
        isAdmin
      />,
    );

    expect(
      await screen.findByText("Service agreement discussion"),
    ).toBeInTheDocument();

    expect(screen.getByText(/meeting/i)).toBeInTheDocument();

    // 2026-08-25T13:30Z is August 25 in New York.
    expect(
      screen.getByText(/Aug 25, 2026/),
    ).toBeInTheDocument();
  });

  test("shows an empty state when no Interactions exist", async () => {
    vi.mocked(getInteractions).mockResolvedValue(
      listResponse([]),
    );

    renderWithRouter(
      <ContactInteractions
        contactId="contact-1"
        facilityId="facility-a"
        facilityTimezone="America/New_York"
        isAdmin
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "No Interactions recorded for this Contact.",
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Service agreement discussion"),
    ).not.toBeInTheDocument();
  });
});

describe("Contact Interaction History security", () => {
  test("does not display Interactions from another Facility", async () => {
    vi.mocked(getInteractions).mockResolvedValue(
      listResponse([
        interaction,
        {
          ...interaction,
          _id: "interaction-other-facility",
          facilityId: "facility-b",
          summary: "Confidential Facility B meeting",
        },
      ]),
    );

    renderWithRouter(
      <ContactInteractions
        contactId="contact-1"
        facilityId="facility-a"
        facilityTimezone="America/New_York"
        isAdmin
      />,
    );

    expect(
      await screen.findByText("Service agreement discussion"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Confidential Facility B meeting"),
    ).not.toBeInTheDocument();
  });

  test("does not display Interactions linked to another Contact", async () => {
    vi.mocked(getInteractions).mockResolvedValue(
      listResponse([
        interaction,
        {
          ...interaction,
          _id: "interaction-other-contact",
          contactIds: ["contact-2"],
          summary: "Unrelated Contact discussion",
        },
      ]),
    );

    renderWithRouter(
      <ContactInteractions
        contactId="contact-1"
        facilityId="facility-a"
        facilityTimezone="America/New_York"
        isAdmin
      />,
    );

    expect(
      await screen.findByText("Service agreement discussion"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Unrelated Contact discussion"),
    ).not.toBeInTheDocument();
  });

  test("technicians cannot view restricted Interactions", async () => {
    vi.mocked(getInteractions).mockResolvedValue(
      listResponse([
        interaction,
        {
          ...interaction,
          _id: "interaction-restricted",
          visibility: "restricted",
          summary: "Restricted contract negotiation",
        },
      ]),
    );

    renderWithRouter(
      <ContactInteractions
        contactId="contact-1"
        facilityId="facility-a"
        facilityTimezone="America/New_York"
        isAdmin={false}
      />,
    );

    expect(
      await screen.findByText("Service agreement discussion"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Restricted contract negotiation"),
    ).not.toBeInTheDocument();
  });

  test("does not display archived Interactions", async () => {
    vi.mocked(getInteractions).mockResolvedValue(
      listResponse([
        interaction,
        {
          ...interaction,
          _id: "interaction-archived",
          archivedAt: "2026-08-26T12:00:00.000Z",
          archivedBy: "user-1",
          summary: "Archived vendor negotiation",
        },
      ]),
    );

    renderWithRouter(
      <ContactInteractions
        contactId="contact-1"
        facilityId="facility-a"
        facilityTimezone="America/New_York"
        isAdmin
      />,
    );

    expect(
      await screen.findByText("Service agreement discussion"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Archived vendor negotiation"),
    ).not.toBeInTheDocument();
  });
});

test("ignores a stale Interaction response after switching Contacts", async () => {
  let resolveOldRequest:
    | ((value: InteractionListResponse) => void)
    | undefined;

  const oldRequest = new Promise<InteractionListResponse>((resolve) => {
    resolveOldRequest = resolve;
  });

  const contactBInteraction: Interaction = {
    ...interaction,
    _id: "interaction-b",
    contactIds: ["contact-b"],
    summary: "Contact B service discussion",
  };

  vi.mocked(getInteractions).mockImplementation(
    async (_facilityId, params) => {
      if (params?.contactId === "contact-b") {
        return listResponse([contactBInteraction]);
      }

      return oldRequest;
    },
  );

  const { rerender } = renderWithRouter(
    <ContactInteractions
      contactId="contact-a"
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  // Contact A's request remains pending.
  expect(getInteractions).toHaveBeenCalledWith(
    "facility-a",
    {
      contactId: "contact-a",
      page: 1,
      limit: 5,
    },
  );

  // User switches to Contact B.
  rerender(
    <ContactInteractions
      contactId="contact-b"
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  expect(
    await screen.findByText("Contact B service discussion"),
  ).toBeInTheDocument();

  // Contact A's response arrives after Contact B is displayed.
  await act(async () => {
    resolveOldRequest?.(
      listResponse([
        {
          ...interaction,
          contactIds: ["contact-a"],
          summary: "Old Contact A discussion",
        },
      ]),
    );

    await oldRequest;
  });

  // Contact B must remain authoritative.
  expect(
    screen.getByText("Contact B service discussion"),
  ).toBeInTheDocument();

  expect(
    screen.queryByText("Old Contact A discussion"),
  ).not.toBeInTheDocument();

  expect(getInteractions).toHaveBeenCalledWith(
    "facility-a",
    {
      contactId: "contact-b",
      page: 1,
      limit: 5,
    },
  );
});

test("does not display previously loaded history after Contact changes", async () => {
  vi.mocked(getInteractions).mockImplementation(
    (_facilityId, params) => {
      if (params?.contactId === "contact-b") {
        // Keep Contact B loading so stale Contact A data
        // would be visible if it were not cleared.
        return new Promise<InteractionListResponse>(() => {});
      }

      return Promise.resolve(listResponse([interaction]));
    },
  );

  const { rerender } = renderWithRouter(
    <ContactInteractions
      contactId="contact-1"
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  expect(
    await screen.findByText("Service agreement discussion"),
  ).toBeInTheDocument();

  rerender(
    <ContactInteractions
      contactId="contact-b"
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  // Contact A's previously displayed information must be gone.
  expect(
    screen.queryByText("Service agreement discussion"),
  ).not.toBeInTheDocument();

  expect(
    screen.getByText("Loading Interactions…"),
  ).toBeInTheDocument();
});

test("displays an error when Contact Interaction history cannot be loaded", async () => {
  vi.mocked(getInteractions).mockRejectedValue(
    new Error("Interaction service unavailable"),
  );

  renderWithRouter(
    <ContactInteractions
      contactId="contact-1"
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  expect(
    await screen.findByRole("alert"),
  ).toHaveTextContent(
    "Recent Interactions could not be loaded.",
  );

  expect(
    screen.queryByText("Service agreement discussion"),
  ).not.toBeInTheDocument();

  expect(getInteractions).toHaveBeenCalledTimes(1);
});

test("ignores stale Interaction responses after Facility changes", async () => {
  let resolveOldRequest:
    | ((value: InteractionListResponse) => void)
    | undefined;

  const oldRequest = new Promise<InteractionListResponse>((resolve) => {
    resolveOldRequest = resolve;
  });

  const facilityBInteraction: Interaction = {
    ...interaction,
    _id: "interaction-b",
    facilityId: "facility-b",
    summary: "Facility B service discussion",
  };

  vi.mocked(getInteractions).mockImplementation(
    (_facilityId) => {
      if (_facilityId === "facility-b") {
        return Promise.resolve(
          listResponse([facilityBInteraction]),
        );
      }

      return oldRequest;
    },
  );

  const { rerender } = renderWithRouter(
    <ContactInteractions
      contactId="contact-1"
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  expect(getInteractions).toHaveBeenCalledWith(
    "facility-a",
    {
      contactId: "contact-1",
      page: 1,
      limit: 5,
    },
  );

  // Switch to Facility B while Facility A's request is pending.
  rerender(
    <ContactInteractions
      contactId="contact-1"
      facilityId="facility-b"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  expect(
    await screen.findByText("Facility B service discussion"),
  ).toBeInTheDocument();

  // Facility A's response arrives after Facility B is displayed.
  await act(async () => {
    resolveOldRequest?.(
      listResponse([
        {
          ...interaction,
          summary: "Old Facility A discussion",
        },
      ]),
    );

    await oldRequest;
  });

  expect(
    screen.getByText("Facility B service discussion"),
  ).toBeInTheDocument();

  expect(
    screen.queryByText("Old Facility A discussion"),
  ).not.toBeInTheDocument();

  expect(getInteractions).toHaveBeenCalledWith(
    "facility-b",
    {
      contactId: "contact-1",
      page: 1,
      limit: 5,
    },
  );
});

test("View All Interactions navigates to the selected Contact history", async () => {
  renderWithRouter(
    <ContactInteractions
      contactId="contact-1"
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  expect(
    await screen.findByText("Service agreement discussion"),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", {
      name: "View All Interactions",
    }),
  );

  expect(
    screen.getByTestId("location"),
  ).toHaveTextContent("/interactions?contactId=contact-1");

  expect(getInteractions).toHaveBeenCalledWith(
    "facility-a",
    {
      contactId: "contact-1",
      page: 1,
      limit: 5,
    },
  );
});

test("View All Interactions safely encodes Contact IDs", async () => {
  const contactId = "contact id&other=value";

  vi.mocked(getInteractions).mockResolvedValue(
    listResponse([]),
  );

  renderWithRouter(
    <ContactInteractions
      contactId={contactId}
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      isAdmin
    />,
  );

  expect(
    await screen.findByText(
      "No Interactions recorded for this Contact.",
    ),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", {
      name: "View All Interactions",
    }),
  );

  expect(
    screen.getByTestId("location"),
  ).toHaveTextContent(
    `/interactions?contactId=${encodeURIComponent(contactId)}`,
  );
});
