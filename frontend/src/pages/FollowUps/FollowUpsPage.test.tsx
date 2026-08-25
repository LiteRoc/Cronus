import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import FollowUpsPage from "./FollowUpsPage";
import type { FollowUp } from "@/types/FollowUp";

const api = vi.hoisted(() => ({
  getFollowUps: vi.fn(), getFollowUp: vi.fn(), createFollowUp: vi.fn(), updateFollowUp: vi.fn(),
  completeFollowUp: vi.fn(), cancelFollowUp: vi.fn(), archiveFollowUp: vi.fn(), getFollowUpAssignees: vi.fn(),
  getContacts: vi.fn(),
}));
const context = vi.hoisted(() => ({ facilityId: "facility-a", role: "admin", timezoneA: "America/New_York" }));
vi.mock("@/services/followUpAPI", () => api);
vi.mock("@/services/contactAPI", () => ({ getContacts: api.getContacts }));
vi.mock("@/context/UserContext", () => ({ useUser: () => ({ user: { _id: "actor", role: context.role } }) }));
vi.mock("@/context/FacilityContext", () => ({ useFacility: () => ({
  selectedFacilityId: context.facilityId,
  availableFacilities: [{ _id: "facility-a", name: "A", timezone: context.timezoneA }, { _id: "facility-b", name: "B" }],
  loading: false,
}) }));

const followUp = (overrides: Partial<FollowUp> = {}): FollowUp => ({
  _id: "followup-1", facilityId: "facility-a", title: "Call Avery", description: "Discuss service",
  dueAt: "2026-08-25T13:30:00.000Z", status: "open", priority: "normal", assignedTo: "user-1",
  contactId: "contact-1", completedAt: null, completedBy: null, cancelledAt: null, cancelledBy: null,
  archivedAt: null, archivedBy: null, createdBy: "actor", updatedBy: "actor",
  createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", overdue: true, ...overrides,
});
const list = (followUps = [followUp()]) => ({ followUps, total: followUps.length, page: 1, limit: 20, totalPages: followUps.length ? 1 : 0 });
const LocationProbe = () => { const location = useLocation(); return <div data-testid="location">{location.pathname}{location.search}</div>; };
const renderPage = (entry = "/followups") => render(<MemoryRouter initialEntries={[entry]}><FollowUpsPage /></MemoryRouter>);
const renderPageWithLocation = (entry: string) => render(<MemoryRouter initialEntries={[entry]}><FollowUpsPage /><LocationProbe /></MemoryRouter>);
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

beforeEach(() => {
  context.facilityId = "facility-a"; context.role = "admin"; context.timezoneA = "America/New_York";
  api.getFollowUps.mockReset().mockResolvedValue(list());
  api.getFollowUp.mockReset().mockResolvedValue(followUp());
  api.getFollowUpAssignees.mockReset().mockResolvedValue([{ _id: "user-1", name: "Taylor", role: "technician" }]);
  api.getContacts.mockReset().mockResolvedValue({ contacts: [{ _id: "contact-1", firstName: "Avery", lastName: "Morgan" }], total: 1, page: 1, limit: 100, totalPages: 1 });
  for (const method of ["createFollowUp", "updateFollowUp", "completeFollowUp", "cancelFollowUp", "archiveFollowUp"] as const) api[method].mockReset().mockResolvedValue(followUp());
});

describe("FollowUpsPage", () => {
  test("renders list, backend overdue, Facility timezone, assignee and Contact", async () => {
    renderPage();
    expect(await screen.findByText("Call Avery")).toBeInTheDocument();
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Taylor").length).toBeGreaterThan(0);
    expect(screen.getByText(/Facility — America\/New_York/)).toBeInTheDocument();
  });

  test("creates with required assignee, Contact, priority and ISO due instant", async () => {
    api.getFollowUps.mockResolvedValue(list([]));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /add followup/i }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Schedule visit" } });
    fireEvent.change(screen.getByLabelText(/due date and time/i), { target: { value: "2026-08-25T09:30" } });
    fireEvent.change(screen.getByLabelText(/^assignee$/i), { target: { value: "user-1" } });
    fireEvent.change(screen.getByLabelText(/^contact$/i), { target: { value: "contact-1" } });
    fireEvent.change(screen.getByLabelText(/priority/i), { target: { value: "high" } });
    fireEvent.click(screen.getByRole("button", { name: /save followup/i }));
    await waitFor(() => expect(api.createFollowUp).toHaveBeenCalledWith("facility-a", expect.objectContaining({
      title: "Schedule visit", dueAt: "2026-08-25T13:30:00.000Z", assignedTo: "user-1", contactId: "contact-1", priority: "high",
    })));
  });

  test("edits only open records and supports Contact unlinking", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("Call Avery"));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/^contact$/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save followup/i }));
    await waitFor(() => expect(api.updateFollowUp).toHaveBeenCalledWith("facility-a", "followup-1", expect.objectContaining({ contactId: null })));
  });

  test.each(["completed", "cancelled"] as const)("renders %s terminal record read-only without overdue", async (status) => {
    api.getFollowUps.mockResolvedValue(list([followUp({ status, overdue: true })]));
    api.getFollowUp.mockResolvedValue(followUp({ status, overdue: true }));
    renderPage();
    fireEvent.click(await screen.findByText("Call Avery"));
    expect(await screen.findByText(/terminal FollowUp is read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryAllByText("Overdue")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /reopen/i })).not.toBeInTheDocument();
  });

  test.each([["complete", "completeFollowUp"], ["cancel followup", "cancelFollowUp"]] as const)("confirms %s", async (button, method) => {
    renderPage(); fireEvent.click(await screen.findByText("Call Avery"));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(button, "i") }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`confirm ${button.split(" ")[0]}`, "i") }));
    await waitFor(() => expect(api[method]).toHaveBeenCalledWith("facility-a", "followup-1"));
  });

  test("archive is admin-only", async () => {
    const view = renderPage(); fireEvent.click(await screen.findByText("Call Avery"));
    expect(await screen.findByRole("button", { name: "Archive" })).toBeInTheDocument();
    view.unmount(); context.role = "technician"; renderPage(); fireEvent.click(await screen.findByText("Call Avery"));
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  test("Facility switch synchronously clears list, detail, filters and form", async () => {
    const view = renderPage(); fireEvent.click(await screen.findByText("Call Avery")); await screen.findByRole("button", { name: "Edit" });
    fireEvent.change(screen.getByLabelText("Search Follow Ups"), { target: { value: "old search" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText("Edit FollowUp")).toBeInTheDocument();
    api.getFollowUps.mockReturnValue(new Promise(() => undefined)); api.getFollowUpAssignees.mockReturnValue(new Promise(() => undefined)); api.getContacts.mockReturnValue(new Promise(() => undefined));
    context.facilityId = "facility-b"; view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    expect(screen.queryByText("Call Avery")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit FollowUp")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Search Follow Ups")).toHaveValue("");
  });

  test("ignores stale list success and failure after Facility change", async () => {
    const old = deferred<ReturnType<typeof list>>();
    api.getFollowUps.mockReturnValueOnce(old.promise);
    const view = renderPage();
    context.facilityId = "facility-b"; api.getFollowUps.mockResolvedValue(new Promise(() => undefined)); view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    await act(async () => old.resolve(list([followUp({ title: "Stale A" })])));
    expect(screen.queryByText("Stale A")).not.toBeInTheDocument();
    const staleFailure = deferred<ReturnType<typeof list>>();
    context.facilityId = "facility-a"; api.getFollowUps.mockReturnValueOnce(staleFailure.promise); view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    context.facilityId = "facility-b"; view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    await act(async () => staleFailure.reject(new Error("old")));
    expect(screen.queryByText(/operation failed/i)).not.toBeInTheDocument();
  });

  test("ignores stale mutation success and failure", async () => {
    const save = deferred<FollowUp>(); api.createFollowUp.mockReturnValueOnce(save.promise);
    const view = renderPage(); fireEvent.click(await screen.findByRole("button", { name: /add followup/i }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "New" } }); fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: "2026-08-25T09:30" } }); fireEvent.change(screen.getByLabelText(/^assignee$/i), { target: { value: "user-1" } }); fireEvent.click(screen.getByRole("button", { name: /save/i }));
    context.facilityId = "facility-b"; view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    await act(async () => save.resolve(followUp({ title: "Stale saved" })));
    expect(screen.queryByText("Stale saved")).not.toBeInTheDocument();
  });

  test("shows safe mutation errors inside form", async () => {
    api.createFollowUp.mockRejectedValue({ isAxiosError: true, response: { status: 403, data: {} } });
    renderPage(); fireEvent.click(await screen.findByRole("button", { name: /add followup/i }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "New" } }); fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: "2026-08-25T09:30" } }); fireEvent.change(screen.getByLabelText(/^assignee$/i), { target: { value: "user-1" } }); fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/permission/i);
    expect(screen.getByText("Add FollowUp")).toBeInTheDocument();
  });

  test("labels browser-local timezone fallback", async () => {
    context.facilityId = "facility-b"; renderPage();
    expect(await screen.findByText(/Time zone: Local —/)).toBeInTheDocument();
  });

  test("ignores stale detail success and failure", async () => {
    const old = deferred<FollowUp>(); api.getFollowUp.mockReturnValueOnce(old.promise);
    const view = renderPage(); fireEvent.click(await screen.findByText("Call Avery"));
    context.facilityId = "facility-b"; api.getFollowUps.mockReturnValue(new Promise(() => undefined)); view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    await act(async () => old.resolve(followUp({ title: "Stale detail" })));
    expect(screen.queryByText("Stale detail")).not.toBeInTheDocument();

    view.unmount(); context.facilityId = "facility-a"; api.getFollowUps.mockResolvedValue(list()); api.getFollowUpAssignees.mockResolvedValue([]); api.getContacts.mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    const failure = deferred<FollowUp>(); api.getFollowUp.mockReturnValueOnce(failure.promise); const failureView = renderPage();
    fireEvent.click(await screen.findByText("Call Avery")); context.facilityId = "facility-b"; failureView.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    await act(async () => failure.reject(new Error("stale detail failure")));
    expect(screen.queryByText(/operation failed/i)).not.toBeInTheDocument();
  });

  test.each([
    ["complete", "completeFollowUp"], ["cancel followup", "cancelFollowUp"], ["archive", "archiveFollowUp"],
  ] as const)("ignores stale %s success and failure", async (label, method) => {
    const success = deferred<FollowUp>(); api[method].mockReturnValueOnce(success.promise);
    const view = renderPage(); fireEvent.click(await screen.findByText("Call Avery"));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${label}$`, "i") }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    context.facilityId = "facility-b"; api.getFollowUps.mockReturnValue(new Promise(() => undefined)); view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    await act(async () => success.resolve(followUp({ title: "Stale action" })));
    expect(screen.queryByText("Stale action")).not.toBeInTheDocument();

    view.unmount(); context.facilityId = "facility-a"; api.getFollowUps.mockResolvedValue(list()); api.getFollowUpAssignees.mockResolvedValue([]); api.getContacts.mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    const failure = deferred<FollowUp>(); api[method].mockReturnValueOnce(failure.promise); const failureView = renderPage();
    fireEvent.click(await screen.findByText("Call Avery")); fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${label}$`, "i") })); fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    context.facilityId = "facility-b"; failureView.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>); await act(async () => failure.reject(new Error("stale action failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("ignores stale assignee and Contact options and clears confirmation state", async () => {
    const people = deferred<Array<{ _id: string; name: string; role: "technician" }>>();
    const contactOptions = deferred<Awaited<ReturnType<typeof api.getContacts>>>();
    api.getFollowUpAssignees.mockReturnValueOnce(people.promise); api.getContacts.mockReturnValueOnce(contactOptions.promise);
    const view = renderPage(); fireEvent.click(await screen.findByText("Call Avery")); fireEvent.click(await screen.findByRole("button", { name: /^complete$/i }));
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    context.facilityId = "facility-b"; api.getFollowUpAssignees.mockReturnValue(new Promise(() => undefined)); api.getContacts.mockReturnValue(new Promise(() => undefined)); api.getFollowUps.mockReturnValue(new Promise(() => undefined));
    view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
    await act(async () => {
      people.resolve([{ _id: "stale-user", name: "Stale User", role: "technician" }]);
      contactOptions.resolve({ contacts: [{ _id: "stale-contact", firstName: "Stale", lastName: "Contact" }], total: 1, page: 1, limit: 100, totalPages: 1 });
    });
    expect(screen.queryByText("Stale User")).not.toBeInTheDocument();
    expect(screen.queryByText("Stale Contact")).not.toBeInTheDocument();
  });

  test("ignores a stale rejected create after Facility switch", async () => {
    const request = deferred<FollowUp>();
    api.createFollowUp.mockReturnValueOnce(request.promise);
    const view = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /add followup/i }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Facility A create" } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: "2026-08-25T09:30" } });
    fireEvent.change(screen.getByLabelText(/^assignee$/i), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: /save followup/i }));
    context.facilityId = "facility-b";
    api.getFollowUps.mockResolvedValue(list([])); api.getFollowUpAssignees.mockResolvedValue([]); api.getContacts.mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    await act(async () => request.reject(new Error("Facility A create failed with INTERNAL_DETAIL")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Facility A create|INTERNAL_DETAIL|Saving/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Add FollowUp" })).not.toBeInTheDocument();
    expect(screen.getByText(/Select a FollowUp to view details/i)).toBeInTheDocument();
  });

  test("ignores a stale rejected update after Facility switch", async () => {
    const request = deferred<FollowUp>();
    api.updateFollowUp.mockReturnValueOnce(request.promise);
    const view = renderPage();
    fireEvent.click(await screen.findByText("Call Avery"));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Facility A update" } });
    fireEvent.click(screen.getByRole("button", { name: /save followup/i }));
    context.facilityId = "facility-b";
    api.getFollowUps.mockResolvedValue(list([])); api.getFollowUpAssignees.mockResolvedValue([]); api.getContacts.mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    await act(async () => request.reject(new Error("Facility A update failed with INTERNAL_DETAIL")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Facility A update|INTERNAL_DETAIL|Saving/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Edit FollowUp")).not.toBeInTheDocument();
    expect(screen.getByText(/Select a FollowUp to view details/i)).toBeInTheDocument();
  });

  test.each([
    [400, /Title is required/i],
    [401, /session is no longer valid/i],
    [403, /do not have permission/i],
    [404, /unavailable in the selected Facility/i],
    [500, /service is unavailable/i],
  ])("shows safe create form error for %s", async (statusCode, expected) => {
    api.createFollowUp.mockRejectedValue({
      isAxiosError: true,
      response: { status: statusCode, data: { error: statusCode === 400 ? "Title is required" : "SENSITIVE_INTERNAL_DETAIL" } },
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /add followup/i }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "New FollowUp" } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: "2026-08-25T09:30" } });
    fireEvent.change(screen.getByLabelText(/^assignee$/i), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: /save followup/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByText("Add FollowUp")).toBeInTheDocument();
    expect(screen.queryByText(/SENSITIVE_INTERNAL_DETAIL/)).not.toBeInTheDocument();
  });

  test.each([
    [400, /Title is required/i],
    [401, /session is no longer valid/i],
    [403, /do not have permission/i],
    [404, /unavailable in the selected Facility/i],
    [500, /service is unavailable/i],
  ])("shows safe edit form error for %s", async (statusCode, expected) => {
    api.updateFollowUp.mockRejectedValue({
      isAxiosError: true,
      response: { status: statusCode, data: { error: statusCode === 400 ? "Title is required" : "SENSITIVE_INTERNAL_DETAIL" } },
    });
    renderPage();
    fireEvent.click(await screen.findByText("Call Avery"));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: /save followup/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByText("Edit FollowUp")).toBeInTheDocument();
    expect(screen.queryByText(/SENSITIVE_INTERNAL_DETAIL/)).not.toBeInTheDocument();
  });

  test.each([
    [400, /Check the FollowUp information/i],
    [401, /session is no longer valid/i],
    [403, /do not have permission/i],
    [404, /unavailable in the selected Facility/i],
    [500, /service is unavailable/i],
  ])("shows safe lifecycle confirmation error for %s", async (statusCode, expected) => {
    api.completeFollowUp.mockRejectedValue({
      isAxiosError: true,
      response: { status: statusCode, data: { error: statusCode === 400 ? undefined : "SENSITIVE_INTERNAL_DETAIL" } },
    });
    renderPage();
    fireEvent.click(await screen.findByText("Call Avery"));
    fireEvent.click(await screen.findByRole("button", { name: /^complete$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm complete/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(screen.queryByText(/SENSITIVE_INTERNAL_DETAIL/)).not.toBeInTheDocument();
  });

  test("requires due date before sending create", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /add followup/i }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Missing due date" } });
    fireEvent.change(screen.getByLabelText(/^assignee$/i), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: /save followup/i }));
    expect(api.createFollowUp).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/due date/i)).toBeInvalid();
  });

  test("requires assignee before sending create", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /add followup/i }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Missing assignee" } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: "2026-08-25T09:30" } });
    fireEvent.click(screen.getByRole("button", { name: /save followup/i }));
    expect(api.createFollowUp).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^assignee$/i)).toBeInvalid();
  });

  test("composes all list filters, pagination, and explicit Facility context", async () => {
    api.getFollowUps.mockResolvedValue({ followUps: [followUp()], total: 60, page: 1, limit: 20, totalPages: 3 });
    renderPage();
    await screen.findByText("Call Avery");
    fireEvent.change(screen.getByLabelText("Search Follow Ups"), { target: { value: "MRI" } });
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "open" } });
    fireEvent.change(screen.getByLabelText("Assignee filter"), { target: { value: "user-1" } });
    fireEvent.change(screen.getByLabelText("Contact filter"), { target: { value: "contact-1" } });
    fireEvent.change(screen.getByLabelText("Due from"), { target: { value: "2026-08-25T09:00" } });
    fireEvent.change(screen.getByLabelText("Due to"), { target: { value: "2026-08-25T17:00" } });
    fireEvent.change(screen.getByLabelText("Overdue filter"), { target: { value: "true" } });
    fireEvent.submit(screen.getByRole("search"));
    fireEvent.change(await screen.findByLabelText(/Rows per page/i), { target: { value: "25" } });
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() => expect(api.getFollowUps).toHaveBeenLastCalledWith("facility-a", {
      search: "MRI", status: "open", assignedTo: "user-1", contactId: "contact-1",
      dueFrom: "2026-08-25T13:00:00.000Z", dueTo: "2026-08-25T21:00:00.000Z",
      overdue: true, page: 2, limit: 25,
    }));
  });

  test("clears Contact-prefilled create state and URL when Facility changes", async () => {
    const view = renderPageWithLocation("/followups?contactId=contact-1&create=true");
    expect(await screen.findByText("Add FollowUp")).toBeInTheDocument();
    expect(screen.getByLabelText(/^contact$/i)).toHaveValue("contact-1");
    expect(screen.getByLabelText("Contact filter")).toHaveValue("contact-1");
    context.facilityId = "facility-b";
    api.getFollowUps.mockResolvedValue(list([])); api.getFollowUpAssignees.mockResolvedValue([]); api.getContacts.mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    view.rerender(<MemoryRouter initialEntries={["/followups?contactId=contact-1&create=true"]}><FollowUpsPage /><LocationProbe /></MemoryRouter>);
    expect(screen.queryByText("Add FollowUp")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Contact filter")).toHaveValue("");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/followups$/));
    expect(screen.getByLabelText("Contact filter").querySelectorAll("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /add followup/i }));
    expect(screen.getByLabelText(/^contact$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^contact$/i).querySelectorAll("option")).toHaveLength(1);
    expect(api.createFollowUp).not.toHaveBeenCalled();
  });

  test("clears observable list, counts, pagination, detail, filters, options, and confirmation on Facility switch", async () => {
    api.getFollowUps.mockResolvedValue({ followUps: [followUp()], total: 60, page: 1, limit: 20, totalPages: 3 });
    const view = renderPage();
    fireEvent.click(await screen.findByText("Call Avery"));
    await screen.findByRole("button", { name: /^complete$/i });
    fireEvent.change(screen.getByLabelText("Search Follow Ups"), { target: { value: "old" } });
    fireEvent.submit(screen.getByRole("search"));
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "open" } });
    fireEvent.change(screen.getByLabelText("Assignee filter"), { target: { value: "user-1" } });
    fireEvent.change(screen.getByLabelText("Contact filter"), { target: { value: "contact-1" } });
    fireEvent.change(screen.getByLabelText("Due from"), { target: { value: "2026-08-25T09:00" } });
    fireEvent.change(screen.getByLabelText("Due to"), { target: { value: "2026-08-25T17:00" } });
    fireEvent.change(screen.getByLabelText("Overdue filter"), { target: { value: "true" } });
    fireEvent.change(screen.getByLabelText(/Rows per page/i), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /^complete$/i }));
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    context.facilityId = "facility-b";
    api.getFollowUps.mockResolvedValue(list([])); api.getFollowUpAssignees.mockResolvedValue([]); api.getContacts.mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    expect(screen.queryByText("Call Avery")).not.toBeInTheDocument();
    expect(screen.queryByText(/60 total|cannot be undone|Edit FollowUp/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Add FollowUp" })).not.toBeInTheDocument();
    expect(screen.getByText(/Select a FollowUp to view details/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Search Follow Ups")).toHaveValue("");
    expect(screen.getByLabelText("Status filter")).toHaveValue("");
    expect(screen.getByLabelText("Assignee filter")).toHaveValue("");
    expect(screen.getByLabelText("Contact filter")).toHaveValue("");
    expect(screen.getByLabelText("Due from")).toHaveValue("");
    expect(screen.getByLabelText("Due to")).toHaveValue("");
    expect(screen.getByLabelText("Overdue filter")).toHaveValue("");
    expect(screen.getByLabelText("Assignee filter").querySelectorAll("option")).toHaveLength(1);
    expect(screen.getByLabelText("Contact filter").querySelectorAll("option")).toHaveLength(1);
  });

  test.each(["assignee", "contact"] as const)("ignores stale rejected %s option request after Facility switch", async (kind) => {
    const failure = deferred<never>();
    if (kind === "assignee") api.getFollowUpAssignees.mockReturnValueOnce(failure.promise);
    else api.getContacts.mockReturnValueOnce(failure.promise);
    const view = renderPage();
    context.facilityId = "facility-b";
    api.getFollowUps.mockResolvedValue(list([])); api.getFollowUpAssignees.mockResolvedValue([]); api.getContacts.mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    await act(async () => failure.reject(new Error("Facility A SENSITIVE_PICKER_FAILURE")));
    expect(screen.queryByText(/SENSITIVE_PICKER_FAILURE|operation failed|service is unavailable/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Assignee filter").querySelectorAll("option")).toHaveLength(1);
    expect(screen.getByLabelText("Contact filter").querySelectorAll("option")).toHaveLength(1);
  });

  test("clears page and form errors when Facility changes", async () => {
    api.createFollowUp.mockRejectedValue({ isAxiosError: true, response: { status: 403, data: {} } });
    const view = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /add followup/i }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Error state" } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: "2026-08-25T09:30" } });
    fireEvent.change(screen.getByLabelText(/^assignee$/i), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    context.facilityId = "facility-b";
    api.getFollowUps.mockResolvedValue(list([])); api.getFollowUpAssignees.mockResolvedValue([]); api.getContacts.mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Error state|Saving/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Add FollowUp")).not.toBeInTheDocument();
  });

  test("invalid Facility timezone falls back to explicitly labeled browser timezone", async () => {
    const browserZone = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ timeZone: "America/Chicago" } as Intl.ResolvedDateTimeFormatOptions);
    context.timezoneA = "Invalid/Facility_Zone";
    renderPage();
    expect(await screen.findByText("Time zone: Local — America/Chicago")).toBeInTheDocument();
    expect(screen.queryByText(/Facility —|America\/New_York/)).not.toBeInTheDocument();
    browserZone.mockRestore();
  });

  test("clears a page-level error when Facility changes", async () => {
    api.getFollowUps.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 500, data: { error: "SENSITIVE_FACILITY_A_FAILURE" } },
    });
    const view = renderPage();
    expect(await screen.findByText(/FollowUp service is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/SENSITIVE_FACILITY_A_FAILURE/)).not.toBeInTheDocument();
    context.facilityId = "facility-b";
    api.getFollowUps.mockResolvedValue(list([])); api.getFollowUpAssignees.mockResolvedValue([]); api.getContacts.mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    view.rerender(<MemoryRouter><FollowUpsPage /></MemoryRouter>);
    expect(screen.queryByText(/FollowUp service is unavailable|SENSITIVE_FACILITY_A_FAILURE/i)).not.toBeInTheDocument();
  });
});
