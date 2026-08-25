import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import { useFacility } from "@/context/FacilityContext";
import { useUser } from "@/context/UserContext";
import { archiveContact, createContact, getContact, getContacts, updateContact } from "@/services/contactAPI";
import type { Contact, ContactDuplicateWarning, ContactInput } from "@/types/Contact";
import ContactForm from "./ContactForm";
import ContactWarnings from "./ContactWarnings";
import ContactFollowUps from "./ContactFollowUps";

const errorMessage = (error: unknown) => {
  if (!axios.isAxiosError(error)) return "Contact operation failed. Please try again.";
  const status = error.response?.status;
  const serverMessage = typeof error.response?.data?.error === "string" ? error.response.data.error : null;
  if (status === 400) return serverMessage ?? "Check the Contact information and try again.";
  if (status === 401) return "Your session is no longer valid. Please sign in again.";
  if (status === 403) return "You do not have permission for this Contact operation.";
  if (status === 404) return "The Contact is unavailable in the selected Facility.";
  return "Contact service is unavailable. Please try again.";
};

export default function ContactsPage() {
  const { selectedFacilityId, availableFacilities, loading: facilitiesLoading } = useFacility();
  const { user } = useUser();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [warnings, setWarnings] = useState<ContactDuplicateWarning[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [stateFacilityId, setStateFacilityId] = useState(selectedFacilityId);
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);
  const mutationRequestId = useRef(0);
  const selectedFacilityRef = useRef(selectedFacilityId);
  selectedFacilityRef.current = selectedFacilityId;

  if (stateFacilityId !== selectedFacilityId) {
    listRequestId.current += 1;
    detailRequestId.current += 1;
    mutationRequestId.current += 1;
    setStateFacilityId(selectedFacilityId);
    setContacts([]);
    setTotal(0);
    setTotalPages(0);
    setSelected(null);
    setWarnings([]);
    setError(null);
    setFormError(null);
    setFormMode(null);
    setSearchInput("");
    setSearch("");
    setPage(1);
    setLoading(false);
    setDetailLoading(false);
    setSubmitting(false);
  }

  const role = user?.role;
  const isAdmin = role === "admin";
  const canUseContacts = isAdmin || role === "technician";
  const canEditSelected = Boolean(selected && selectedFacilityId === selected.primaryFacilityId);

  const facilityNames = useMemo(
    () => new Map(availableFacilities.map((facility) => [facility._id, facility.name])),
    [availableFacilities],
  );

  const loadContacts = useCallback(async () => {
    if (!selectedFacilityId || !canUseContacts) return;
    const requestId = ++listRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getContacts(selectedFacilityId, { search: search || undefined, page, limit: pageSize });
      if (requestId !== listRequestId.current) return;
      setContacts(result.contacts);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (requestError) {
      if (requestId !== listRequestId.current) return;
      setError(errorMessage(requestError));
      setContacts([]);
    } finally {
      if (requestId === listRequestId.current) setLoading(false);
    }
  }, [canUseContacts, page, pageSize, search, selectedFacilityId]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const openDetail = async (contactId: string) => {
    if (!selectedFacilityId) return;
    const requestId = ++detailRequestId.current;
    setWarnings([]);
    setFormError(null);
    setDetailLoading(true);
    setError(null);
    try {
      const result = await getContact(selectedFacilityId, contactId);
      if (requestId !== detailRequestId.current) return;
      setSelected(result);
    } catch (requestError) {
      if (requestId !== detailRequestId.current) return;
      setError(errorMessage(requestError));
      setSelected(null);
    } finally {
      if (requestId === detailRequestId.current) setDetailLoading(false);
    }
  };

  const saveContact = async (input: ContactInput) => {
    if (!selectedFacilityId) return;
    const facilityId = selectedFacilityId;
    const requestId = ++mutationRequestId.current;
    setSubmitting(true);
    setError(null);
    setFormError(null);
    setWarnings([]);
    try {
      const result = formMode === "edit" && selected
        ? await updateContact(facilityId, selected._id, input)
        : await createContact(facilityId, input);
      if (requestId !== mutationRequestId.current || selectedFacilityRef.current !== facilityId) return;
      setSelected(result.contact);
      setWarnings(result.warnings ?? []);
      setFormMode(null);
      await loadContacts();
    } catch (requestError) {
      if (requestId !== mutationRequestId.current || selectedFacilityRef.current !== facilityId) return;
      setFormError(errorMessage(requestError));
    } finally {
      if (requestId === mutationRequestId.current) setSubmitting(false);
    }
  };

  const archiveSelected = async () => {
    if (!selectedFacilityId || !selected || !isAdmin || !canEditSelected) return;
    if (!window.confirm(`Archive ${selected.firstName} ${selected.lastName}?`)) return;
    const facilityId = selectedFacilityId;
    const requestId = ++mutationRequestId.current;
    setSubmitting(true);
    setError(null);
    try {
      await archiveContact(facilityId, selected._id);
      if (requestId !== mutationRequestId.current || selectedFacilityRef.current !== facilityId) return;
      setSelected(null);
      setWarnings([]);
      await loadContacts();
    } catch (requestError) {
      if (requestId !== mutationRequestId.current || selectedFacilityRef.current !== facilityId) return;
      setError(errorMessage(requestError));
    } finally {
      if (requestId === mutationRequestId.current) setSubmitting(false);
    }
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  if (!canUseContacts) return <ErrorMessage message="Contacts are not available for your role." />;
  if (facilitiesLoading) return <LoadingSpinner message="Loading Facilities…" />;
  if (!selectedFacilityId) return <ErrorMessage message="Select a Facility to view Contacts." />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
          <p className="mt-1 text-sm text-gray-600">Facility-scoped people and relationship details.</p>
        </div>
        <Button onClick={() => { setSelected(null); setWarnings([]); setError(null); setFormError(null); setFormMode("create"); }}>+ Add Contact</Button>
      </div>

      {error && <ErrorMessage message={error} />}
      <ContactWarnings warnings={warnings} />

      <form className="flex max-w-xl gap-2" onSubmit={submitSearch} role="search">
        <input
          aria-label="Search Contacts"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={200}
          placeholder="Search name, title, email, or phone"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm" aria-label="Contact list">
          {loading ? <LoadingSpinner message="Loading Contacts…" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Title / role</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contacts.map((contact) => (
                    <tr key={contact._id} className="cursor-pointer hover:bg-blue-50" onClick={() => void openDetail(contact._id)}>
                      <td className="px-4 py-3 font-medium text-gray-900">{contact.firstName} {contact.lastName}</td>
                      <td className="px-4 py-3 text-gray-600">{contact.title || contact.functionalDescription || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{contact.email || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{contact.phone || "—"}</td>
                    </tr>
                  ))}
                  {!contacts.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-500">No Contacts found for this Facility.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={totalPages} totalCount={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPage(1); setPageSize(size); }} />
          </div>
        </section>

        <aside className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="Contact details">
          {detailLoading ? <LoadingSpinner message="Loading Contact…" /> : selected ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-xl font-semibold">{selected.firstName} {selected.lastName}</h2><p className="text-sm text-gray-500">{selected.title || selected.functionalDescription || "No title provided"}</p></div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs capitalize text-gray-700">{selected.status}</span>
              </div>
              {!canEditSelected && <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Read-only from this associated Facility. Edit from the primary Facility.</div>}
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="font-medium text-gray-600">Email</dt><dd>{selected.email || "—"}</dd>
                <dt className="font-medium text-gray-600">Phone</dt><dd>{selected.phone || "—"}</dd>
                <dt className="font-medium text-gray-600">Role</dt><dd>{selected.functionalDescription || "—"}</dd>
                <dt className="font-medium text-gray-600">Notes</dt><dd className="whitespace-pre-wrap">{selected.notes || "—"}</dd>
              </dl>
              <div><h3 className="text-sm font-semibold text-gray-800">Associated Facilities</h3><ul className="mt-2 space-y-2 text-sm">{selected.facilityIds.map((id) => <li key={id} className="flex items-center gap-2"><span>{facilityNames.get(id) ?? "Facility"}</span>{id === selected.primaryFacilityId && <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Primary</span>}</li>)}</ul></div>
              <ContactFollowUps contactId={selected._id} />
              {canEditSelected && <div className="flex flex-wrap gap-3"><Button onClick={() => { setWarnings([]); setError(null); setFormError(null); setFormMode("edit"); }}>Edit Contact</Button>{isAdmin && <Button variant="destructive" disabled={submitting} onClick={() => void archiveSelected()}>Archive Contact</Button>}</div>}
            </div>
          ) : <p className="text-sm text-gray-500">Select a Contact to view details.</p>}
        </aside>
      </div>

      <Modal isOpen={formMode !== null} onClose={() => setFormMode(null)} title={formMode === "edit" ? "Edit Contact" : "Add Contact"} className="relative max-h-[90vh] w-[min(760px,calc(100vw-2rem))] overflow-y-auto">
        <ContactForm contact={formMode === "edit" ? selected : null} selectedFacilityId={selectedFacilityId} facilities={availableFacilities} submitting={submitting} error={formError} onCancel={() => { setFormMode(null); setFormError(null); }} onSubmit={saveContact} />
      </Modal>
    </div>
  );
}
