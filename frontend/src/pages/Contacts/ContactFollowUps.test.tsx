import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ContactFollowUps from "./ContactFollowUps";

const api = vi.hoisted(() => ({ getFollowUps: vi.fn(), getFollowUpAssignees: vi.fn() }));
const context = vi.hoisted(() => ({ facilityId: "facility-a" }));
vi.mock("@/services/followUpAPI", () => api);
vi.mock("@/context/FacilityContext", () => ({ useFacility: () => ({
  selectedFacilityId: context.facilityId,
  availableFacilities: [{ _id: "facility-a", timezone: "UTC" }, { _id: "facility-b" }],
}) }));
const result = (title: string) => ({ followUps: [{ _id: title, title, dueAt: "2026-09-01T12:00:00.000Z", priority: "high", assignedTo: "user-1", status: "open", overdue: true }], total: 1, page: 1, limit: 5, totalPages: 1 });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; };
const Location = () => { const current = useLocation(); return <div data-testid="location">{current.pathname}{current.search}</div>; };
const renderSection = (contactId = "contact-1") => render(<MemoryRouter><Routes><Route path="*" element={<><ContactFollowUps contactId={contactId} /><Location /></>} /></Routes></MemoryRouter>);

beforeEach(() => {
  context.facilityId = "facility-a";
  api.getFollowUps.mockReset().mockResolvedValue(result("Call Avery"));
  api.getFollowUpAssignees.mockReset().mockResolvedValue([{ _id: "user-1", name: "Taylor", role: "technician" }]);
});

describe("Contact Open FollowUps", () => {
  test("requests five open FollowUps with Contact scope", async () => {
    renderSection();
    expect(await screen.findByText("Call Avery")).toBeInTheDocument();
    expect(api.getFollowUps).toHaveBeenCalledWith("facility-a", { contactId: "contact-1", status: "open", limit: 5 });
    expect(screen.getByText(/Overdue/)).toBeInTheDocument();
  });
  test("navigates to view and create with safe Contact preselection", async () => {
    renderSection("contact id");
    await screen.findByText("Call Avery");
    fireEvent.click(screen.getByRole("button", { name: /view all/i }));
    expect(screen.getByTestId("location")).toHaveTextContent("/followups?contactId=contact%20id");
    fireEvent.click(screen.getByRole("button", { name: /create followup/i }));
    expect(screen.getByTestId("location")).toHaveTextContent("create=true");
  });
  test("clears immediately and ignores stale success when Contact changes", async () => {
    const old = deferred<ReturnType<typeof result>>(); api.getFollowUps.mockReturnValueOnce(old.promise);
    const view = renderSection("contact-a");
    api.getFollowUps.mockReturnValue(new Promise(() => undefined));
    view.rerender(<MemoryRouter><ContactFollowUps contactId="contact-b" /></MemoryRouter>);
    expect(screen.queryByText("Old Contact")).not.toBeInTheDocument();
    await act(async () => old.resolve(result("Old Contact")));
    expect(screen.queryByText("Old Contact")).not.toBeInTheDocument();
  });
  test("clears immediately and ignores stale response when Facility changes", async () => {
    const old = deferred<ReturnType<typeof result>>(); api.getFollowUps.mockReturnValueOnce(old.promise);
    const view = renderSection();
    context.facilityId = "facility-b"; api.getFollowUps.mockReturnValue(new Promise(() => undefined));
    view.rerender(<MemoryRouter><ContactFollowUps contactId="contact-1" /></MemoryRouter>);
    await act(async () => old.resolve(result("Old Facility")));
    expect(screen.queryByText("Old Facility")).not.toBeInTheDocument();
  });
  test("clears an already-rendered Contact result synchronously when Contact changes", async () => {
    const view = renderSection("contact-a");
    expect(await screen.findByText("Call Avery")).toBeInTheDocument();
    api.getFollowUps.mockReturnValue(new Promise(() => undefined));
    view.rerender(<MemoryRouter><ContactFollowUps contactId="contact-b" /></MemoryRouter>);
    expect(screen.queryByText("Call Avery")).not.toBeInTheDocument();
  });
  test("ignores stale failure after Facility changes", async () => {
    let reject!: (error: unknown) => void;
    api.getFollowUps.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    const view = renderSection();
    context.facilityId = "facility-b"; api.getFollowUps.mockReturnValue(new Promise(() => undefined));
    view.rerender(<MemoryRouter><ContactFollowUps contactId="contact-1" /></MemoryRouter>);
    await act(async () => reject(new Error("old Facility")));
    expect(screen.queryByText(/could not be loaded/i)).not.toBeInTheDocument();
  });
});
