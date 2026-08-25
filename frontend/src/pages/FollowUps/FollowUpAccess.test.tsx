import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import FollowUpRoute, { canAccessFollowUpUI } from "./FollowUpRoute";
import { useSidebarLinks } from "@/hooks/useSidebarLinks";

const auth = vi.hoisted(() => ({ role: undefined as string | undefined }));
vi.mock("@/context/UserContext", () => ({ useUser: () => ({ user: auth.role ? { role: auth.role } : null }) }));

describe("FollowUp route and navigation", () => {
  test.each([
    ["admin", true], ["technician", true], ["customer", false], ["viewer", false],
    ["tech", false], [undefined, false], ["unknown", false],
  ])("canonical role %s access is %s", (role, allowed) => {
    auth.role = role;
    render(<MemoryRouter initialEntries={["/followups"]}><Routes><Route path="/followups" element={<FollowUpRoute content={<div>FollowUp UI</div>} />} /><Route path="/dashboard" element={<div>Dashboard</div>} /></Routes></MemoryRouter>);
    expect(canAccessFollowUpUI(role)).toBe(allowed);
    expect(Boolean(screen.queryByText("FollowUp UI"))).toBe(allowed);
    const navRole = role === "admin" || role === "technician" ? role : "viewer";
    expect(useSidebarLinks(navRole, false, canAccessFollowUpUI(role)).some((item) => item.to === "/followups")).toBe(allowed);
  });
});
