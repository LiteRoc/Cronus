import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import { getInteractions } from "@/services/interactionAPI";
import type { InteractionListResponse } from "@/types/Interaction";
import InteractionRoute from "./InteractionRoute";

const context = vi.hoisted(() => ({
  facilityId: "facility-a",
  role: "admin",
  userId: "user-1",
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({
    user: {
      _id: context.userId,
      role: context.role,
    },
  }),
}));

vi.mock("@/context/FacilityContext", () => ({
  useFacility: () => ({
    selectedFacilityId: context.facilityId,
    availableFacilities: [
      {
        _id: "facility-a",
        timezone: "America/New_York",
      },
    ],
  }),
}));

vi.mock("@/services/interactionAPI", () => ({
  getInteractions: vi.fn(),
  getInteraction: vi.fn(),
  createInteraction: vi.fn(),
  updateInteraction: vi.fn(),
  archiveInteraction: vi.fn(),
}));

vi.mock("@/services/contactAPI", () => ({
  getContacts: vi.fn(),
}));

const emptyResponse: InteractionListResponse = {
  interactions: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
};

function NavigationControls() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <div data-testid="location">
        {location.pathname}
        {location.search}
      </div>

      <button
        type="button"
        onClick={() => navigate("/interactions?contactId=contact-b")}
      >
        Open Contact B
      </button>
    </div>
  );
}

beforeEach(() => {
  context.facilityId = "facility-a";
  context.role = "admin";
  context.userId = "user-1";

  vi.mocked(getInteractions).mockReset();
  vi.mocked(getInteractions).mockResolvedValue(emptyResponse);
});

test("route applies Contact filter, updates it, and clears it without Facility-wide fallback", async () => {
  render(
    <MemoryRouter initialEntries={["/interactions?contactId=contact-a"]}>
      <NavigationControls />

      <Routes>
        <Route
          path="/interactions"
          element={<InteractionRoute />}
        />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(getInteractions).toHaveBeenCalledWith(
      "facility-a",
      expect.objectContaining({
        contactId: "contact-a",
      }),
    );
  });

  expect(
    screen.getByTestId("location"),
  ).toHaveTextContent("/interactions?contactId=contact-a");

  expect(
    screen.getByText("Showing Interactions for the selected Contact."),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", {
      name: "Open Contact B",
    }),
  );

  await waitFor(() => {
    expect(getInteractions).toHaveBeenCalledWith(
      "facility-a",
      expect.objectContaining({
        contactId: "contact-b",
      }),
    );
  });

  expect(
    screen.getByTestId("location"),
  ).toHaveTextContent("/interactions?contactId=contact-b");

  fireEvent.click(
    screen.getByRole("button", {
      name: "Clear Contact Filter",
    }),
  );

  await waitFor(() => {
    expect(getInteractions).toHaveBeenLastCalledWith(
      "facility-a",
      expect.objectContaining({
        contactId: undefined,
      }),
    );
  });

  expect(
    screen.getByTestId("location"),
  ).toHaveTextContent("/interactions");

  expect(
    screen.getByTestId("location"),
  ).not.toHaveTextContent("contactId=");

  expect(
    screen.queryByText("Showing Interactions for the selected Contact."),
  ).not.toBeInTheDocument();
});
