import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ContactsPage from "./ContactsPage";
import type { Contact } from "@/types/Contact";

const api = vi.hoisted(() => ({
  getContacts: vi.fn(),
  getContact: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  archiveContact: vi.fn(),
}));

const context = vi.hoisted(() => ({
  role: "admin",
  selectedFacilityId: "facility-primary",
  includeOrganizationMetadata: true,
}));

vi.mock("@/services/contactAPI", () => api);
vi.mock("@/context/UserContext", () => ({
  useUser: () => ({ user: { _id: "user-1", role: context.role } }),
}));
vi.mock("@/context/FacilityContext", () => ({
  useFacility: () => ({
    selectedFacilityId: context.selectedFacilityId,
    availableFacilities: [
      { _id: "facility-primary", name: "Primary Hospital", organizationId: context.includeOrganizationMetadata ? "org-1" : undefined },
      { _id: "facility-secondary", name: "Outpatient Center", organizationId: context.includeOrganizationMetadata ? "org-1" : undefined },
      { _id: "facility-other", name: "Other Organization", organizationId: context.includeOrganizationMetadata ? "org-2" : undefined },
    ],
    loading: false,
  }),
}));

const contact = (overrides: Partial<Contact> = {}): Contact => ({
  _id: "contact-1",
  organizationId: "org-1",
  primaryFacilityId: "facility-primary",
  facilityIds: ["facility-primary", "facility-secondary"],
  firstName: "Avery",
  lastName: "Morgan",
  title: "Clinical Director",
  functionalDescription: "Clinical operations",
  email: "avery@example.test",
  phone: "937-555-0100",
  notes: "Prefers email",
  status: "active",
  createdBy: "user-1",
  updatedBy: "user-1",
  archivedAt: null,
  archivedBy: null,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
  ...overrides,
});

const listResponse = (contacts: Contact[] = [contact()]) => ({
  contacts,
  total: contacts.length,
  page: 1,
  limit: 20,
  totalPages: contacts.length ? 1 : 0,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  context.role = "admin";
  context.selectedFacilityId = "facility-primary";
  context.includeOrganizationMetadata = true;
  api.getContacts.mockReset().mockResolvedValue(listResponse());
  api.getContact.mockReset().mockResolvedValue(contact());
  api.createContact.mockReset().mockResolvedValue({ contact: contact(), warnings: [] });
  api.updateContact.mockReset().mockResolvedValue({ contact: contact(), warnings: [] });
  api.archiveContact.mockReset().mockResolvedValue(contact({ status: "archived" }));
});

describe("ContactsPage", () => {
  test("renders the selected Facility list and passes Facility context to the API", async () => {
    render(<ContactsPage />);
    expect(await screen.findByText("Avery Morgan")).toBeInTheDocument();
    expect(api.getContacts).toHaveBeenCalledWith("facility-primary", { search: undefined, page: 1, limit: 20 });
    expect(screen.queryByText("normalizedEmail")).not.toBeInTheDocument();
  });

  test("does not expose Contact UI to customer or viewer roles", () => {
    for (const role of ["customer", "viewer"]) {
      context.role = role;
      const view = render(<ContactsPage />);
      expect(screen.getByText("Contacts are not available for your role.")).toBeInTheDocument();
      view.unmount();
    }
    expect(api.getContacts).not.toHaveBeenCalled();
  });

  test("creates a Contact with selected and same-Organization Facilities", async () => {
    api.getContacts.mockResolvedValue(listResponse([]));
    render(<ContactsPage />);
    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Jordan" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Lee" } });
    fireEvent.click(screen.getByLabelText("Outpatient Center"));
    expect(screen.queryByLabelText("Other Organization")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save contact/i }));
    await waitFor(() => expect(api.createContact).toHaveBeenCalledWith(
      "facility-primary",
      expect.objectContaining({
        firstName: "Jordan",
        lastName: "Lee",
        facilityIds: ["facility-primary", "facility-secondary"],
      }),
    ));
  });

  test("edits from primary Facility and hides archive from technicians", async () => {
    context.role = "technician";
    render(<ContactsPage />);
    fireEvent.click(await screen.findByText("Avery Morgan"));
    expect(await screen.findByRole("button", { name: /edit contact/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /archive contact/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit contact/i }));
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Director" } });
    fireEvent.click(screen.getByRole("button", { name: /save contact/i }));
    await waitFor(() => expect(api.updateContact).toHaveBeenCalledWith(
      "facility-primary",
      "contact-1",
      expect.objectContaining({ title: "Director" }),
    ));
  });

  test("shows archive only to an admin at the primary Facility", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ContactsPage />);
    fireEvent.click(await screen.findByText("Avery Morgan"));
    fireEvent.click(await screen.findByRole("button", { name: /archive contact/i }));
    await waitFor(() => expect(api.archiveContact).toHaveBeenCalledWith("facility-primary", "contact-1"));
  });

  test("renders a secondary-Facility Contact read-only", async () => {
    context.selectedFacilityId = "facility-secondary";
    render(<ContactsPage />);
    fireEvent.click(await screen.findByText("Avery Morgan"));
    expect(await screen.findByText(/read-only from this associated Facility/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit contact/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /archive contact/i })).not.toBeInTheDocument();
  });

  test("ignores a stale Contact detail response after Facility selection changes", async () => {
    let resolveDetail: (value: Contact) => void = () => undefined;
    api.getContact.mockReturnValue(new Promise<Contact>((resolve) => { resolveDetail = resolve; }));
    const view = render(<ContactsPage />);
    fireEvent.click(await screen.findByText("Avery Morgan"));
    context.selectedFacilityId = "facility-secondary";
    view.rerender(<ContactsPage />);
    resolveDetail(contact());
    await waitFor(() => expect(api.getContacts).toHaveBeenCalledWith(
      "facility-secondary",
      expect.any(Object),
    ));
    expect(screen.queryByText("Prefers email")).not.toBeInTheDocument();
  });

  test("displays advisory duplicate warnings without blocking save", async () => {
    api.createContact.mockResolvedValue({
      contact: contact(),
      warnings: [
        { code: "possible_duplicate", matchedOn: ["email"], matches: [{ id: "visible-1", firstName: "Avery", lastName: "Morgan", email: "avery@example.test", matchedOn: ["email"] }] },
        { code: "possible_duplicate", hasRestrictedMatches: true },
      ],
    });
    render(<ContactsPage />);
    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Avery" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Morgan" } });
    fireEvent.click(screen.getByRole("button", { name: /save contact/i }));
    expect(await screen.findByText("Possible duplicate saved")).toBeInTheDocument();
    expect(screen.getByText(/outside this Facility view/i)).toBeInTheDocument();
  });

  test("renders clean authorization and server error states", async () => {
    api.getContacts.mockRejectedValue({ isAxiosError: true, response: { status: 403, data: {} } });
    const view = render(<ContactsPage />);
    expect(await screen.findByText("You do not have permission for this Contact operation.")).toBeInTheDocument();
    view.unmount();

    api.getContacts.mockRejectedValue({ isAxiosError: true, response: { status: 500, data: { error: "internal detail" } } });
    render(<ContactsPage />);
    expect(await screen.findByText("Contact service is unavailable. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText("internal detail")).not.toBeInTheDocument();
  });

  test("searches within the selected Facility", async () => {
    render(<ContactsPage />);
    const search = screen.getByRole("search");
    fireEvent.change(within(search).getByLabelText("Search Contacts"), { target: { value: "Avery" } });
    fireEvent.submit(search);
    await waitFor(() => expect(api.getContacts).toHaveBeenCalledWith("facility-primary", { search: "Avery", page: 1, limit: 20 }));
  });

  test("immediately clears list, totals, pagination, detail, warnings, errors, and search on Facility switch", async () => {
    api.getContacts.mockResolvedValue({ ...listResponse([contact()]), total: 30, totalPages: 2 });
    const view = render(<ContactsPage />);
    fireEvent.change(screen.getByLabelText("Search Contacts"), { target: { value: "Avery" } });
    expect(await screen.findByText(/30 total/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(api.getContacts).toHaveBeenCalledWith("facility-primary", expect.objectContaining({ page: 2 })));
    fireEvent.click(screen.getByText("Avery Morgan"));
    expect(await screen.findByText("Prefers email")).toBeInTheDocument();

    api.getContacts.mockImplementation((facilityId: string) => (
      facilityId === "facility-secondary" ? new Promise(() => undefined) : Promise.resolve(listResponse())
    ));
    context.selectedFacilityId = "facility-secondary";
    view.rerender(<ContactsPage />);

    expect(screen.queryByText("Avery Morgan")).not.toBeInTheDocument();
    expect(screen.queryByText(/30 total/)).not.toBeInTheDocument();
    expect(screen.queryByText("Prefers email")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Search Contacts")).toHaveValue("");
    expect(api.getContacts).toHaveBeenCalledWith("facility-secondary", expect.objectContaining({ page: 1 }));
  });

  test("clears duplicate warnings and page errors on Facility switch", async () => {
    api.createContact.mockResolvedValue({ contact: contact(), warnings: [{ code: "possible_duplicate", hasRestrictedMatches: true }] });
    const view = render(<ContactsPage />);
    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Warning" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Case" } });
    fireEvent.click(screen.getByRole("button", { name: /save contact/i }));
    expect(await screen.findByText("Possible duplicate saved")).toBeInTheDocument();

    api.getContacts.mockImplementation(() => new Promise(() => undefined));
    context.selectedFacilityId = "facility-secondary";
    view.rerender(<ContactsPage />);
    expect(screen.queryByText("Possible duplicate saved")).not.toBeInTheDocument();

    view.unmount();
    context.selectedFacilityId = "facility-primary";
    api.getContacts.mockRejectedValue({ isAxiosError: true, response: { status: 403, data: {} } });
    const errorView = render(<ContactsPage />);
    expect(await screen.findByText(/do not have permission/i)).toBeInTheDocument();
    api.getContacts.mockImplementation(() => new Promise(() => undefined));
    context.selectedFacilityId = "facility-secondary";
    errorView.rerender(<ContactsPage />);
    expect(screen.queryByText(/do not have permission/i)).not.toBeInTheDocument();
  });

  test("closes and discards a create form on Facility switch", async () => {
    const view = render(<ContactsPage />);
    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Unsaved" } });
    context.selectedFacilityId = "facility-secondary";
    view.rerender(<ContactsPage />);
    expect(screen.queryByRole("button", { name: /save contact/i })).not.toBeInTheDocument();

    context.selectedFacilityId = "facility-primary";
    view.rerender(<ContactsPage />);
    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    expect(screen.getByLabelText(/first name/i)).toHaveValue("");
  });

  test("closes an edit form on Facility switch and cannot convert it into create", async () => {
    const view = render(<ContactsPage />);
    fireEvent.click(await screen.findByText("Avery Morgan"));
    fireEvent.click(await screen.findByRole("button", { name: /edit contact/i }));
    context.selectedFacilityId = "facility-secondary";
    view.rerender(<ContactsPage />);
    expect(screen.queryByRole("button", { name: /save contact/i })).not.toBeInTheDocument();
    expect(api.createContact).not.toHaveBeenCalled();
    expect(api.updateContact).not.toHaveBeenCalled();
  });

  test("ignores a stale list response after Facility switch", async () => {
    const first = deferred<ReturnType<typeof listResponse>>();
    api.getContacts.mockImplementation((facilityId: string) => (
      facilityId === "facility-primary" ? first.promise : Promise.resolve(listResponse([contact({ _id: "contact-b", firstName: "Blair" })]))
    ));
    const view = render(<ContactsPage />);
    context.selectedFacilityId = "facility-secondary";
    view.rerender(<ContactsPage />);
    expect(await screen.findByText("Blair Morgan")).toBeInTheDocument();
    await act(async () => first.resolve(listResponse([contact({ firstName: "Facility A" })])));
    expect(screen.queryByText("Facility A Morgan")).not.toBeInTheDocument();
  });

  test("ignores stale save success and duplicate warnings after Facility switch", async () => {
    const save = deferred<{ contact: Contact; warnings: Array<{ code: string; hasRestrictedMatches: boolean }> }>();
    api.createContact.mockReturnValue(save.promise);
    const view = render(<ContactsPage />);
    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Avery" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Morgan" } });
    fireEvent.click(screen.getByRole("button", { name: /save contact/i }));
    context.selectedFacilityId = "facility-secondary";
    view.rerender(<ContactsPage />);
    await act(async () => save.resolve({ contact: contact(), warnings: [{ code: "possible_duplicate", hasRestrictedMatches: true }] }));
    expect(screen.queryByText("Possible duplicate saved")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save contact/i })).not.toBeInTheDocument();
  });

  test("ignores a stale save failure after Facility switch", async () => {
    const save = deferred<never>();
    api.createContact.mockReturnValue(save.promise);
    const view = render(<ContactsPage />);
    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Avery" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Morgan" } });
    fireEvent.click(screen.getByRole("button", { name: /save contact/i }));
    context.selectedFacilityId = "facility-secondary";
    view.rerender(<ContactsPage />);
    await act(async () => save.reject({ isAxiosError: true, response: { status: 403, data: {} } }));
    expect(screen.queryByText(/do not have permission/i)).not.toBeInTheDocument();
  });

  test.each(["resolve", "reject"])("ignores stale archive %s after Facility switch", async (outcome) => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const archive = deferred<Contact>();
    api.archiveContact.mockReturnValue(archive.promise);
    const view = render(<ContactsPage />);
    fireEvent.click(await screen.findByText("Avery Morgan"));
    fireEvent.click(await screen.findByRole("button", { name: /archive contact/i }));
    context.selectedFacilityId = "facility-secondary";
    view.rerender(<ContactsPage />);
    await act(async () => {
      if (outcome === "resolve") archive.resolve(contact({ status: "archived" }));
      else archive.reject({ isAxiosError: true, response: { status: 500, data: {} } });
    });
    expect(screen.queryByText(/service is unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Prefers email")).not.toBeInTheDocument();
  });

  test("fails closed for new Facility associations when Organization metadata is missing", () => {
    context.includeOrganizationMetadata = false;
    render(<ContactsPage />);
    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    expect(screen.queryByLabelText("Outpatient Center")).not.toBeInTheDocument();
    expect(screen.getByText(/associations are unavailable when Organization information is missing/i)).toBeInTheDocument();
  });

  test("renders a restricted-only duplicate warning without match metadata", async () => {
    api.createContact.mockResolvedValue({ contact: contact(), warnings: [{ code: "possible_duplicate", hasRestrictedMatches: true }] });
    render(<ContactsPage />);
    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Avery" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Morgan" } });
    fireEvent.click(screen.getByRole("button", { name: /save contact/i }));
    const warning = (await screen.findByText(/outside this Facility view/i)).closest<HTMLElement>('[role="status"]')!;
    expect(warning).toBeInTheDocument();
    expect(within(warning).queryByText(/avery@example.test/i)).not.toBeInTheDocument();
  });

  test.each([
    [400, "Validation failed", "Validation failed"],
    [401, null, "Your session is no longer valid"],
    [403, null, "You do not have permission"],
    [404, null, "unavailable in the selected Facility"],
    [500, "sensitive detail", "Contact service is unavailable"],
  ])("shows safe %s mutation errors inside the open form", async (status, serverError, expected) => {
    api.createContact.mockRejectedValue({ isAxiosError: true, response: { status, data: { error: serverError } } });
    render(<ContactsPage />);
    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Error" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Case" } });
    fireEvent.click(screen.getByRole("button", { name: /save contact/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(new RegExp(String(expected), "i"));
    expect(alert.closest("form")).not.toBeNull();
    if (status === 500) expect(alert).not.toHaveTextContent("sensitive detail");
  });

  test.each([
    [400, "Validation failed", "Validation failed"],
    [401, null, "Your session is no longer valid"],
    [403, null, "You do not have permission"],
    [404, null, "unavailable in the selected Facility"],
    [500, "sensitive detail", "Contact service is unavailable"],
  ])("shows safe %s edit errors inside the open form", async (status, serverError, expected) => {
    api.updateContact.mockRejectedValue({ isAxiosError: true, response: { status, data: { error: serverError } } });
    render(<ContactsPage />);
    fireEvent.click(await screen.findByText("Avery Morgan"));
    fireEvent.click(await screen.findByRole("button", { name: /edit contact/i }));
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: /save contact/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(new RegExp(String(expected), "i"));
    expect(alert.closest("form")).not.toBeNull();
    if (status === 500) expect(alert).not.toHaveTextContent("sensitive detail");
  });
});
