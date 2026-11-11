import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import InteractionRoute, {
  canAccessInteractionUI,
} from "./InteractionRoute";

import { useSidebarLinks } from "@/hooks/useSidebarLinks";

const context = vi.hoisted(() => ({
  role: null as string | null,
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({
    user: context.role ? { role: context.role } : null,
  }),
}));

vi.mock("@/context/FacilityContext", () => ({
  useFacility: () => ({
    selectedFacilityId: "facility-a",
  }),
}));

beforeEach(() => {
  context.role = null;
});

describe("Interaction route authorization", () => {
  test.each([
    ["admin", true],
    ["technician", true],
    ["customer", false],
    ["viewer", false],
    ["tech", false],
    ["unknown", false],
    [null, false],
  ])(
    "role %s has access=%s",
    (role, allowed) => {
      context.role = role;

      render(
        <MemoryRouter initialEntries={["/interactions"]}>
          <Routes>
            <Route
              path="/interactions"
              element={
                <InteractionRoute
                  content={<div>Interaction UI</div>}
                />
              }
            />
            <Route
              path="/dashboard"
              element={<div>Dashboard</div>}
            />
          </Routes>
        </MemoryRouter>,
      );

      if (allowed) {
        expect(screen.getByText("Interaction UI")).toBeInTheDocument();
      } else {
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
        expect(screen.queryByText("Interaction UI")).not.toBeInTheDocument();
      }

      expect(canAccessInteractionUI(role)).toBe(allowed);

      const navigationRole =
        role === "admin" ||
        role === "technician" ||
        role === "customer"
          ? role
          : "viewer";

      const links = useSidebarLinks(
        navigationRole,
        false,
        false,
        canAccessInteractionUI(role),
      );

      expect(
        links.some((link) => link.to === "/interactions"),
      ).toBe(allowed);
    },
  );
});
