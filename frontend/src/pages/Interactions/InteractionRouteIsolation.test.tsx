import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import InteractionRoute from "./InteractionRoute";

const context = vi.hoisted(() => ({
  userId: "user-a",
  role: "admin",
  facilityId: "facility-a",
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
  }),
}));

// A stateful page substitute lets us verify real React remounting
// without making API requests.
vi.mock("./InteractionsPage", () => ({
  default: function MockInteractionsPage({
    facilityId,
    isAdmin,
  }: {
    facilityId: string | null;
    isAdmin: boolean;
  }) {
    const [draft, setDraft] = useState("");

    return (
      <div>
        <p>Facility: {facilityId}</p>
        <p>Role: {isAdmin ? "Administrator" : "Technician"}</p>

        <input
          aria-label="Interaction page draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
    );
  },
}));

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={["/interactions"]}>
      <Routes>
        <Route
          path="/interactions"
          element={<InteractionRoute />}
        />
        <Route
          path="/dashboard"
          element={<div>Dashboard</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function enterDraft() {
  fireEvent.change(
    screen.getByLabelText("Interaction page draft"),
    {
      target: { value: "Previous session information" },
    },
  );

  expect(
    screen.getByLabelText("Interaction page draft"),
  ).toHaveValue("Previous session information");
}

function expectFreshPage() {
  expect(
    screen.getByLabelText("Interaction page draft"),
  ).toHaveValue("");
}

beforeEach(() => {
  context.userId = "user-a";
  context.role = "admin";
  context.facilityId = "facility-a";
});

describe("Interaction route identity isolation", () => {
  test("Facility changes discard previous page state", () => {
    const view = renderRoute();

    enterDraft();

    context.facilityId = "facility-b";
    view.rerender(
      <MemoryRouter initialEntries={["/interactions"]}>
        <Routes>
          <Route
            path="/interactions"
            element={<InteractionRoute />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Facility: facility-b")).toBeInTheDocument();
    expectFreshPage();
  });

  test("authenticated user changes discard previous page state", () => {
    const view = renderRoute();

    enterDraft();

    context.userId = "user-b";
    view.rerender(
      <MemoryRouter initialEntries={["/interactions"]}>
        <Routes>
          <Route
            path="/interactions"
            element={<InteractionRoute />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Facility: facility-a")).toBeInTheDocument();
    expectFreshPage();
  });

  test("administrator to technician changes discard previous state", () => {
    const view = renderRoute();

    enterDraft();

    context.role = "technician";
    view.rerender(
      <MemoryRouter initialEntries={["/interactions"]}>
        <Routes>
          <Route
            path="/interactions"
            element={<InteractionRoute />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Role: Technician")).toBeInTheDocument();
    expectFreshPage();
  });
});
