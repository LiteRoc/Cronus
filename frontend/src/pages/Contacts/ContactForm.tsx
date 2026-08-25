import { useMemo, useState, type FormEvent } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import type { Contact, ContactInput } from "@/types/Contact";
import type { Facility } from "@/types/Facility";

interface ContactFormProps {
  contact?: Contact | null;
  selectedFacilityId: string;
  facilities: Facility[];
  submitting: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (input: ContactInput) => Promise<void>;
}

const facilityOrganizationId = (facility: Facility) => facility.organizationId ?? facility.organizationalId;

export default function ContactForm({
  contact,
  selectedFacilityId,
  facilities,
  submitting,
  error,
  onCancel,
  onSubmit,
}: ContactFormProps) {
  const primaryFacilityId = contact?.primaryFacilityId ?? selectedFacilityId;
  const [form, setForm] = useState<ContactInput>({
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    title: contact?.title ?? "",
    functionalDescription: contact?.functionalDescription ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    notes: contact?.notes ?? "",
    status: contact?.status === "inactive" ? "inactive" : "active",
    facilityIds: contact?.facilityIds ?? [primaryFacilityId],
  });

  const associationOptions = useMemo(() => {
    const primary = facilities.find((facility) => facility._id === primaryFacilityId);
    const organizationId = contact?.organizationId ?? (primary ? facilityOrganizationId(primary) : undefined);
    return facilities.filter((facility) => {
      if (form.facilityIds.includes(facility._id) || facility._id === primaryFacilityId) return true;
      const candidateOrganization = facilityOrganizationId(facility);
      return Boolean(organizationId && candidateOrganization && candidateOrganization === organizationId);
    });
  }, [contact?.organizationId, facilities, form.facilityIds, primaryFacilityId]);

  const hasUnavailableOrganizationMetadata = useMemo(() => {
    const primary = facilities.find((facility) => facility._id === primaryFacilityId);
    const organizationId = contact?.organizationId ?? (primary ? facilityOrganizationId(primary) : undefined);
    return facilities.some((facility) => {
      if (form.facilityIds.includes(facility._id) || facility._id === primaryFacilityId) return false;
      return !organizationId || !facilityOrganizationId(facility);
    });
  }, [contact?.organizationId, facilities, form.facilityIds, primaryFacilityId]);

  const update = (field: keyof ContactInput, value: string | string[]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleFacility = (facilityId: string) => {
    if (facilityId === primaryFacilityId) return;
    update(
      "facilityIds",
      form.facilityIds.includes(facilityId)
        ? form.facilityIds.filter((id) => id !== facilityId)
        : [...form.facilityIds, facilityId],
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({ ...form, facilityIds: Array.from(new Set([primaryFacilityId, ...form.facilityIds])) });
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      {error && <div className="rounded-lg border border-red-300 bg-red-100 p-3 text-sm text-red-700" role="alert">{error}</div>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">First name *<Input required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></label>
        <label className="text-sm font-medium text-gray-700">Last name *<Input required value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /></label>
        <label className="text-sm font-medium text-gray-700">Title<Input value={form.title} onChange={(event) => update("title", event.target.value)} /></label>
        <label className="text-sm font-medium text-gray-700">Role / function<Input value={form.functionalDescription} onChange={(event) => update("functionalDescription", event.target.value)} /></label>
        <label className="text-sm font-medium text-gray-700">Email<Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
        <label className="text-sm font-medium text-gray-700">Phone<Input value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
        <Select label="Status" value={form.status} onChange={(event) => update("status", event.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      <Textarea label="Notes" rows={4} value={form.notes} onChange={(event) => update("notes", event.target.value)} />

      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-1 text-sm font-semibold text-gray-800">Associated Facilities</legend>
        <p className="mb-3 text-xs text-gray-500">The primary Facility is fixed. Additional Facilities must belong to the same Organization.</p>
        {hasUnavailableOrganizationMetadata && (
          <p className="mb-3 text-xs text-amber-700">Additional Facility associations are unavailable when Organization information is missing.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {associationOptions.map((facility) => (
            <label key={facility._id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.facilityIds.includes(facility._id)}
                disabled={facility._id === primaryFacilityId}
                onChange={() => toggleFacility(facility._id)}
              />
              <span>{facility.name}</span>
              {facility._id === primaryFacilityId && <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Primary</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save Contact"}</Button>
      </div>
    </form>
  );
}
