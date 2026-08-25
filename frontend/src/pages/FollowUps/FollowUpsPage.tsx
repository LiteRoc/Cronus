import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import { useFacility } from "@/context/FacilityContext";
import { useUser } from "@/context/UserContext";
import { getContacts } from "@/services/contactAPI";
import {
  archiveFollowUp, cancelFollowUp, completeFollowUp, createFollowUp, getFollowUp,
  getFollowUpAssignees, getFollowUps, updateFollowUp,
} from "@/services/followUpAPI";
import type { Contact } from "@/types/Contact";
import type { FollowUp, FollowUpAssignee, FollowUpInput, FollowUpStatus } from "@/types/FollowUp";
import FollowUpForm from "./FollowUpForm";
import { displayDueAt, effectiveTimeZone, localDateTimeToIso } from "./dateTime";

const messageFor = (error: unknown) => {
  if (!axios.isAxiosError(error)) return "FollowUp operation failed. Please try again.";
  const status = error.response?.status;
  const server = typeof error.response?.data?.error === "string" ? error.response.data.error : null;
  if (status === 400) return server ?? "Check the FollowUp information and try again.";
  if (status === 401) return "Your session is no longer valid. Please sign in again.";
  if (status === 403) return "You do not have permission for this FollowUp operation.";
  if (status === 404) return "The FollowUp is unavailable in the selected Facility.";
  return "FollowUp service is unavailable. Please try again.";
};

type Action = "complete" | "cancel" | "archive";
export default function FollowUpsPage() {
  const { selectedFacilityId, availableFacilities, loading: facilityLoading } = useFacility();
  const { user } = useUser();
  const [urlParams, setUrlParams] = useSearchParams();
  const initialContact = urlParams.get("contactId") || "";
  const initialCreate = urlParams.get("create") === "true";
  const [items, setItems] = useState<FollowUp[]>([]);
  const [selected, setSelected] = useState<FollowUp | null>(null);
  const [assignees, setAssignees] = useState<FollowUpAssignee[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FollowUpStatus | "">("");
  const [assignee, setAssignee] = useState("");
  const [contact, setContact] = useState(initialContact);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [overdue, setOverdue] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(initialCreate ? "create" : null);
  const [action, setAction] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stateFacilityId, setStateFacilityId] = useState(selectedFacilityId);
  const listGeneration = useRef(0);
  const detailGeneration = useRef(0);
  const mutationGeneration = useRef(0);
  const optionGeneration = useRef(0);
  const facilityRef = useRef(selectedFacilityId);
  const urlFacilityRef = useRef(selectedFacilityId);
  facilityRef.current = selectedFacilityId;

  if (stateFacilityId !== selectedFacilityId) {
    listGeneration.current += 1; detailGeneration.current += 1; mutationGeneration.current += 1; optionGeneration.current += 1;
    setStateFacilityId(selectedFacilityId); setItems([]); setSelected(null); setAssignees([]); setContacts([]);
    setSearchInput(""); setSearch(""); setStatus(""); setAssignee(""); setContact(""); setDueFrom(""); setDueTo(""); setOverdue("");
    setPage(1); setTotal(0); setTotalPages(0); setLoading(false); setDetailLoading(false); setSubmitting(false);
    setFormMode(null); setAction(null); setError(null); setFormError(null); setActionError(null);
  }

  const role = user?.role;
  const allowed = role === "admin" || role === "technician";
  const isAdmin = role === "admin";
  const facility = availableFacilities.find((item) => item._id === selectedFacilityId);
  const validFacilityZone = (() => { try { if (facility?.timezone) new Intl.DateTimeFormat("en", { timeZone: facility.timezone }).format(); return facility?.timezone; } catch { return undefined; } })();
  const zone = effectiveTimeZone(validFacilityZone);
  const timezoneLabel = validFacilityZone ? `Time zone: Facility — ${zone}` : `Time zone: Local — ${zone}`;
  const assigneeNames = useMemo(() => new Map(assignees.map((item) => [item._id, item.name])), [assignees]);
  const contactNames = useMemo(() => new Map(contacts.map((item) => [item._id, `${item.firstName} ${item.lastName}`])), [contacts]);

  const loadOptions = useCallback(async () => {
    if (!selectedFacilityId || !allowed) return;
    const facilityId = selectedFacilityId;
    const generation = ++optionGeneration.current;
    try {
      const [people, contactResult] = await Promise.all([getFollowUpAssignees(facilityId), getContacts(facilityId, { limit: 100 })]);
      if (generation !== optionGeneration.current || facilityRef.current !== facilityId) return;
      setAssignees(people); setContacts(contactResult.contacts);
    } catch (caught) {
      if (generation !== optionGeneration.current || facilityRef.current !== facilityId) return;
      setError(messageFor(caught)); setAssignees([]); setContacts([]);
    }
  }, [allowed, selectedFacilityId]);

  const loadList = useCallback(async () => {
    if (!selectedFacilityId || !allowed) return;
    const facilityId = selectedFacilityId;
    const generation = ++listGeneration.current;
    setLoading(true); setError(null);
    try {
      const result = await getFollowUps(facilityId, {
        search: search || undefined, status: status || undefined, assignedTo: assignee || undefined,
        contactId: contact || undefined, dueFrom: dueFrom ? localDateTimeToIso(dueFrom, validFacilityZone) : undefined, dueTo: dueTo ? localDateTimeToIso(dueTo, validFacilityZone) : undefined,
        overdue: overdue ? overdue === "true" : undefined, page, limit: pageSize,
      });
      if (generation !== listGeneration.current || facilityRef.current !== facilityId) return;
      setItems(result.followUps); setTotal(result.total); setTotalPages(result.totalPages);
    } catch (caught) {
      if (generation !== listGeneration.current || facilityRef.current !== facilityId) return;
      setError(messageFor(caught)); setItems([]); setTotal(0); setTotalPages(0);
    } finally { if (generation === listGeneration.current) setLoading(false); }
  }, [allowed, assignee, contact, dueFrom, dueTo, overdue, page, pageSize, search, selectedFacilityId, status]);

  useEffect(() => {
    if (urlFacilityRef.current !== selectedFacilityId) {
      urlFacilityRef.current = selectedFacilityId;
      setUrlParams({}, { replace: true });
    }
  }, [selectedFacilityId, setUrlParams]);
  useEffect(() => { void loadOptions(); }, [loadOptions]);
  useEffect(() => { void loadList(); }, [loadList]);

  const openDetail = async (id: string) => {
    if (!selectedFacilityId) return;
    const facilityId = selectedFacilityId;
    const generation = ++detailGeneration.current;
    setDetailLoading(true); setError(null); setFormError(null); setActionError(null);
    try {
      const result = await getFollowUp(facilityId, id);
      if (generation !== detailGeneration.current || facilityRef.current !== facilityId) return;
      setSelected(result);
    } catch (caught) {
      if (generation !== detailGeneration.current || facilityRef.current !== facilityId) return;
      setError(messageFor(caught)); setSelected(null);
    } finally { if (generation === detailGeneration.current) setDetailLoading(false); }
  };

  const save = async (input: FollowUpInput) => {
    if (!selectedFacilityId) return;
    const facilityId = selectedFacilityId;
    const generation = ++mutationGeneration.current;
    const editing = formMode === "edit" ? selected : null;
    setSubmitting(true); setFormError(null);
    try {
      const result = editing ? await updateFollowUp(facilityId, editing._id, input) : await createFollowUp(facilityId, input);
      if (generation !== mutationGeneration.current || facilityRef.current !== facilityId) return;
      setSelected(result); setFormMode(null); setUrlParams({}, { replace: true }); await loadList();
    } catch (caught) {
      if (generation !== mutationGeneration.current || facilityRef.current !== facilityId) return;
      setFormError(messageFor(caught));
    } finally { if (generation === mutationGeneration.current) setSubmitting(false); }
  };

  const performAction = async () => {
    if (!selectedFacilityId || !selected || !action) return;
    const facilityId = selectedFacilityId;
    const generation = ++mutationGeneration.current;
    const currentAction = action;
    setSubmitting(true); setActionError(null);
    try {
      const result = currentAction === "complete" ? await completeFollowUp(facilityId, selected._id)
        : currentAction === "cancel" ? await cancelFollowUp(facilityId, selected._id)
          : await archiveFollowUp(facilityId, selected._id);
      if (generation !== mutationGeneration.current || facilityRef.current !== facilityId) return;
      setFormMode(null); setAction(null);
      if (currentAction === "archive") setSelected(null); else setSelected(result);
      await loadList();
    } catch (caught) {
      if (generation !== mutationGeneration.current || facilityRef.current !== facilityId) return;
      setActionError(messageFor(caught));
    } finally { if (generation === mutationGeneration.current) setSubmitting(false); }
  };

  const searchSubmit = (event: FormEvent) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); };
  if (!allowed) return <ErrorMessage message="Follow Ups are not available for your role." />;
  if (facilityLoading) return <LoadingSpinner message="Loading Facilities…" />;
  if (!selectedFacilityId) return <ErrorMessage message="Select a Facility to view Follow Ups." />;

  return <div className="space-y-6 p-6">
    <div className="flex items-end justify-between"><div><h1 className="text-2xl font-semibold">Follow Ups</h1><p className="text-sm text-gray-600">Facility-scoped operational follow-ups.</p></div>
      <Button onClick={() => { setSelected(null); setFormError(null); setFormMode("create"); }}>+ Add FollowUp</Button></div>
    {error && <ErrorMessage message={error} />}
    <form role="search" className="grid gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={searchSubmit}>
      <input aria-label="Search Follow Ups" maxLength={200} className="rounded border px-3 py-2" placeholder="Search title or description" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
      <select aria-label="Status filter" className="rounded border px-3 py-2" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as FollowUpStatus | ""); }}><option value="">All statuses</option><option value="open">Open</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
      <select aria-label="Assignee filter" className="rounded border px-3 py-2" value={assignee} onChange={(e) => { setPage(1); setAssignee(e.target.value); }}><option value="">All assignees</option>{assignees.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>
      <select aria-label="Contact filter" className="rounded border px-3 py-2" value={contact} onChange={(e) => { setPage(1); setContact(e.target.value); }}><option value="">All Contacts</option>{contacts.map((item) => <option key={item._id} value={item._id}>{item.firstName} {item.lastName}</option>)}</select>
      <label className="text-sm">Due from<input aria-label="Due from" type="datetime-local" className="block w-full rounded border px-3 py-2" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} /></label>
      <label className="text-sm">Due to<input aria-label="Due to" type="datetime-local" className="block w-full rounded border px-3 py-2" value={dueTo} onChange={(e) => setDueTo(e.target.value)} /></label>
      <select aria-label="Overdue filter" className="rounded border px-3 py-2" value={overdue} onChange={(e) => setOverdue(e.target.value as typeof overdue)}><option value="">Any due state</option><option value="true">Overdue</option><option value="false">Not overdue</option></select>
      <Button type="submit" variant="outline">Apply search</Button>
      <p className="md:col-span-4 text-xs text-gray-500">{timezoneLabel}</p>
    </form>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,.8fr)]">
      <section aria-label="FollowUp list" className="overflow-hidden rounded-xl border bg-white shadow-sm">
        {loading ? <LoadingSpinner message="Loading Follow Ups…" /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-600"><tr><th className="px-3 py-3">Due</th><th className="px-3 py-3">Title</th><th className="px-3 py-3">Priority</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Assignee</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Overdue</th></tr></thead><tbody className="divide-y">{items.map((item) => <tr key={item._id} className="cursor-pointer hover:bg-blue-50" onClick={() => void openDetail(item._id)}><td className="px-3 py-3">{displayDueAt(item.dueAt, validFacilityZone)}</td><td className="px-3 py-3 font-medium">{item.title}</td><td className="px-3 py-3 capitalize">{item.priority}</td><td className="px-3 py-3 capitalize">{item.status}</td><td className="px-3 py-3">{assigneeNames.get(item.assignedTo) ?? "Assigned user"}</td><td className="px-3 py-3">{item.contactId ? contactNames.get(item.contactId) ?? "Linked Contact" : "—"}</td><td className="px-3 py-3">{item.status === "open" && item.overdue ? <span className="font-medium text-red-700">Overdue</span> : "—"}</td></tr>)}{!items.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No Follow Ups found for this Facility.</td></tr>}</tbody></table></div>}
        <div className="px-4 pb-4"><Pagination page={page} totalPages={totalPages} totalCount={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPage(1); setPageSize(size); }} /></div>
      </section>
      <aside aria-label="FollowUp details" className="rounded-xl border bg-white p-5 shadow-sm">
        {detailLoading ? <LoadingSpinner message="Loading FollowUp…" /> : selected ? <div className="space-y-4"><div><h2 className="text-xl font-semibold">{selected.title}</h2><p className="capitalize text-sm text-gray-500">{selected.status} · {selected.priority}</p></div>
          <dl className="grid grid-cols-[90px_1fr] gap-2 text-sm"><dt className="font-medium">Due</dt><dd>{displayDueAt(selected.dueAt, validFacilityZone)}</dd><dt className="font-medium">Assignee</dt><dd>{assigneeNames.get(selected.assignedTo) ?? "Assigned user"}</dd><dt className="font-medium">Contact</dt><dd>{selected.contactId ? contactNames.get(selected.contactId) ?? "Linked Contact" : "—"}</dd><dt className="font-medium">Details</dt><dd className="whitespace-pre-wrap">{selected.description || "—"}</dd></dl>
          {selected.status !== "open" && <p className="rounded bg-gray-100 p-3 text-sm">This terminal FollowUp is read-only.</p>}
          <div className="flex flex-wrap gap-2">{selected.status === "open" && <><Button onClick={() => { setFormError(null); setFormMode("edit"); }}>Edit</Button><Button variant="outline" onClick={() => { setActionError(null); setAction("complete"); }}>Complete</Button><Button variant="outline" onClick={() => { setActionError(null); setAction("cancel"); }}>Cancel FollowUp</Button></>}{isAdmin && <Button variant="destructive" onClick={() => { setActionError(null); setAction("archive"); }}>Archive</Button>}</div>
        </div> : <p className="text-sm text-gray-500">Select a FollowUp to view details.</p>}
      </aside>
    </div>
    <Modal isOpen={formMode !== null} onClose={() => { setFormMode(null); setFormError(null); }} title={formMode === "edit" ? "Edit FollowUp" : "Add FollowUp"} className="relative max-h-[90vh] w-[min(700px,calc(100vw-2rem))] overflow-y-auto">
      <FollowUpForm key={`${stateFacilityId}-${formMode}-${selected?._id ?? "new"}`} followUp={formMode === "edit" ? selected : null} assignees={assignees} contacts={contacts} facilityTimezone={validFacilityZone} timezoneLabel={timezoneLabel} submitting={submitting} error={formError} presetContactId={initialContact} onCancel={() => { setFormMode(null); setFormError(null); }} onSubmit={save} />
    </Modal>
    <Modal isOpen={action !== null} onClose={() => { setAction(null); setActionError(null); }} title={action ? `${action[0].toUpperCase() + action.slice(1)} FollowUp` : "Confirm"}>
      <div className="space-y-4">{actionError && <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}<p>Confirm this {action} action. This cannot be undone in Phase 1.</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAction(null)}>Back</Button><Button variant={action === "archive" ? "destructive" : "default"} disabled={submitting} onClick={() => void performAction()}>Confirm {action}</Button></div></div>
    </Modal>
  </div>;
}
