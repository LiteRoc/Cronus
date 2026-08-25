import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui";
import { useFacility } from "@/context/FacilityContext";
import { getFollowUpAssignees, getFollowUps } from "@/services/followUpAPI";
import type { FollowUp, FollowUpAssignee } from "@/types/FollowUp";
import { displayDueAt } from "@/pages/FollowUps/dateTime";

export default function ContactFollowUps({ contactId }: { contactId: string }) {
  const { selectedFacilityId, availableFacilities } = useFacility();
  const navigate = useNavigate();
  const [items, setItems] = useState<FollowUp[]>([]);
  const [assignees, setAssignees] = useState<FollowUpAssignee[]>([]);
  const [error, setError] = useState(false);
  const [stateKey, setStateKey] = useState(`${selectedFacilityId}:${contactId}`);
  const generation = useRef(0);
  const key = `${selectedFacilityId}:${contactId}`;
  if (stateKey !== key) {
    generation.current += 1;
    setStateKey(key); setItems([]); setAssignees([]); setError(false);
  }
  useEffect(() => {
    if (!selectedFacilityId || !contactId) return;
    const facilityId = selectedFacilityId;
    const request = ++generation.current;
    Promise.all([
      getFollowUps(facilityId, { contactId, status: "open", limit: 5 }),
      getFollowUpAssignees(facilityId),
    ]).then(([result, people]) => {
      if (request !== generation.current) return;
      setItems(result.followUps); setAssignees(people);
    }).catch(() => {
      if (request !== generation.current) return;
      setItems([]); setAssignees([]); setError(true);
    });
  }, [contactId, selectedFacilityId]);
  const facility = availableFacilities.find((item) => item._id === selectedFacilityId);
  const names = new Map(assignees.map((item) => [item._id, item.name]));
  return <section aria-label="Open Follow Ups" className="border-t pt-4">
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Open Follow Ups</h3><span className="text-xs text-gray-500">Up to 5</span></div>
    {error ? <p className="mt-2 text-sm text-red-700">Open Follow Ups could not be loaded.</p> : items.length ? <ul className="mt-2 space-y-2">{items.map((item) => <li key={item._id} className="rounded border p-2 text-sm"><div className="flex justify-between gap-2"><span className="font-medium">{item.title}</span>{item.overdue && <span className="text-red-700">Overdue</span>}</div><p className="text-xs text-gray-500">{displayDueAt(item.dueAt, facility?.timezone)} · {item.priority} · {names.get(item.assignedTo) ?? "Assigned user"}</p></li>)}</ul> : <p className="mt-2 text-sm text-gray-500">No open Follow Ups.</p>}
    <div className="mt-3 flex gap-2"><Button variant="outline" onClick={() => navigate(`/followups?contactId=${encodeURIComponent(contactId)}`)}>View all Follow Ups</Button><Button onClick={() => navigate(`/followups?contactId=${encodeURIComponent(contactId)}&create=true`)}>Create FollowUp</Button></div>
  </section>;
}
