import { useState, type FormEvent } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import type { Contact } from "@/types/Contact";
import type { FollowUp, FollowUpAssignee, FollowUpInput, FollowUpPriority } from "@/types/FollowUp";
import { isoToLocalInput, localDateTimeToIso } from "./dateTime";

interface Props {
  followUp?: FollowUp | null;
  assignees: FollowUpAssignee[];
  contacts: Contact[];
  facilityTimezone?: string;
  timezoneLabel: string;
  submitting: boolean;
  error: string | null;
  presetContactId?: string | null;
  onCancel: () => void;
  onSubmit: (input: FollowUpInput) => Promise<void>;
}
export default function FollowUpForm({ followUp, assignees, contacts, facilityTimezone, timezoneLabel, submitting, error, presetContactId, onCancel, onSubmit }: Props) {
  const [form, setForm] = useState({
    title: followUp?.title ?? "",
    description: followUp?.description ?? "",
    dueAt: followUp ? isoToLocalInput(followUp.dueAt, facilityTimezone) : "",
    priority: followUp?.priority ?? "normal" as FollowUpPriority,
    assignedTo: followUp?.assignedTo ?? "",
    contactId: followUp?.contactId ?? presetContactId ?? "",
  });
  const [dateError, setDateError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setDateError(null);
    try {
      await onSubmit({ ...form, dueAt: localDateTimeToIso(form.dueAt, facilityTimezone), contactId: form.contactId || null });
    } catch (caught) {
      setDateError(caught instanceof Error ? caught.message : "Enter a valid due date and time.");
    }
  };
  return <form className="space-y-4" onSubmit={submit}>
    {(error || dateError) && <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error || dateError}</div>}
    <label className="block text-sm font-medium">Title *<Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
    <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
    <label className="block text-sm font-medium">Due date and time *<Input aria-label="Due date and time" required type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></label>
    <p className="text-xs text-gray-500">{timezoneLabel}</p>
    <Select aria-label="Priority" label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as FollowUpPriority })}>
      <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
    </Select>
    <Select aria-label="Assignee" label="Assignee *" required value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
      <option value="">Select an assignee</option>{assignees.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.role})</option>)}
    </Select>
    <Select aria-label="Contact" label="Contact" value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
      <option value="">No linked Contact</option>{contacts.map((contact) => <option key={contact._id} value={contact._id}>{contact.firstName} {contact.lastName}</option>)}
    </Select>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save FollowUp"}</Button></div>
  </form>;
}
