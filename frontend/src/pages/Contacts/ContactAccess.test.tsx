import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ContactRoute, { canAccessContactUI } from "./ContactRoute";
import { useSidebarLinks } from "@/hooks/useSidebarLinks";

const auth = vi.hoisted(() => ({ role: undefined as string | undefined }));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({ user: auth.role === undefined ? null : { _id: "user-1", role: auth.role } }),
}));

beforeEach(() => {
  auth.role = undefined;
});

describe("Contact route and navigation authorization", () => {
  test.each([
    ["admin", true],
    ["technician", true],
    ["customer", false],
    ["viewer", false],
    ["tech", false],
    [undefined, false],
    ["unknown", false],
  ])("role %s Contact access is %s", (role, allowed) => {
    auth.role = role;
    render(
      <MemoryRouter initialEntries={["/contacts"]}>
        <Routes>
          <Route path="/contacts" element={<ContactRoute content={<div>Contact UI</div>} />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(canAccessContactUI(role)).toBe(allowed);
    expect(screen.queryByText("Contact UI") !== null).toBe(allowed);
    expect(screen.queryByText("Dashboard") !== null).toBe(!allowed);

    const navigationRole = role === "admin" || role === "technician" ? role : "viewer";
    const links = useSidebarLinks(navigationRole, canAccessContactUI(role));
    expect(links.some((link) => link.to === "/contacts")).toBe(allowed);
  });
});
