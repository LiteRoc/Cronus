import { useState, type FormEvent } from "react";
import InteractionContactPicker from "./InteractionContactPicker";

import { Button, Input, Select, Textarea } from "@/components/ui";

import type {
  Interaction,
  InteractionDirection,
  InteractionInput,
  InteractionType,
  InteractionVisibility,
} from "@/types/Interaction";

import {
  isoToLocalInput,
  localDateTimeToIso,
} from "@/pages/FollowUps/dateTime";

interface Props {
  interaction?: Interaction | null;
  initialContactIds?: string[];
  facilityId: string;
  facilityTimezone?: string;
  timezoneLabel: string;
  isAdmin: boolean;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (input: InteractionInput | Partial<InteractionInput>) => Promise<void>;
}

const TYPES: Array<{ value: InteractionType; label: string }> = [
  { value: "meeting", label: "Meeting" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "site_visit", label: "Site Visit" },
  { value: "note", label: "Note" },
];

const DIRECTIONS: Array<{
  value: InteractionDirection;
  label: string;
}> = [
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "internal", label: "Internal" },
];

export default function InteractionForm({
  interaction,
  initialContactIds = [],
  facilityId,
  facilityTimezone,
  timezoneLabel,
  isAdmin,
  submitting,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const [form, setForm] = useState({
    type: interaction?.type ?? ("note" as InteractionType),
    occurredAt: isoToLocalInput(
      interaction?.occurredAt ?? new Date().toISOString(),
      facilityTimezone,
    ),
    summary: interaction?.summary ?? "",
    body: interaction?.body ?? "",
    direction: interaction?.direction ?? ("internal" as InteractionDirection),
    visibility: interaction?.visibility ?? ("operational" as InteractionVisibility),
    contactIds: interaction?.contactIds ?? [...initialContactIds],
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    try {
      // Compare the displayed minute, not the full UTC timestamp.
      // An unchanged date retains its original seconds and milliseconds.
      const dateUnchanged = Boolean(
        interaction &&
        form.occurredAt === isoToLocalInput(
          interaction.occurredAt,
          facilityTimezone,
        ),
      );

      const occurredAt = dateUnchanged && interaction
        ? interaction.occurredAt
        : localDateTimeToIso(form.occurredAt, facilityTimezone);

      if (new Date(occurredAt).getTime() > Date.now() + 5 * 60 * 1000) {
        throw new Error(
          "Interactions must record activities that have already occurred.",
        );
      }

      if (!form.summary.trim()) {
        throw new Error("Enter an Interaction summary.");
      }

      const input: InteractionInput = {
  type: form.type,
  occurredAt,
  summary: form.summary.trim(),
  body: form.body.trim(),
  direction: form.direction,
  visibility: isAdmin ? form.visibility : "operational",
  contactIds: form.contactIds,
};

if (!interaction) {
  await onSubmit(input);
  return;
}

const changes: Partial<InteractionInput> = {};

if (input.type !== interaction.type) {
  changes.type = input.type;
}

if (!dateUnchanged) {
  changes.occurredAt = input.occurredAt;
}

if (input.summary !== interaction.summary) {
  changes.summary = input.summary;
}

if (input.body !== interaction.body) {
  changes.body = input.body;
}

if (input.direction !== interaction.direction) {
  changes.direction = input.direction;
}

if (isAdmin && input.visibility !== interaction.visibility) {
  changes.visibility = input.visibility;
}

const originalIds = [...interaction.contactIds].sort();
const selectedIds = [...input.contactIds!].sort();

if (
  originalIds.length !== selectedIds.length ||
  originalIds.some((id, index) => id !== selectedIds[index])
) {
  changes.contactIds = input.contactIds;
}

if (!Object.keys(changes).length) {
  throw new Error("No changes to save.");
}

await onSubmit(changes);
    } catch (caught) {
      setValidationError(
        caught instanceof Error
          ? caught.message
          : "Check the Interaction information and try again.",
      );
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      {(error || validationError) && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {error || validationError}
        </div>
      )}

      <Select
        label="Interaction type"
        aria-label="Interaction type"
        value={form.type}
        onChange={(event) =>
          setForm({
            ...form,
            type: event.target.value as InteractionType,
          })
        }
      >
        {TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </Select>

      <label className="block text-sm font-medium">
        Date and time *
        <Input
          aria-label="Interaction date and time"
          type="datetime-local"
          required
          value={form.occurredAt}
          onChange={(event) =>
            setForm({ ...form, occurredAt: event.target.value })
          }
        />
      </label>

      <p className="text-xs text-gray-500">{timezoneLabel}</p>

      <Select
        label="Direction"
        aria-label="Direction"
        value={form.direction}
        onChange={(event) =>
          setForm({
            ...form,
            direction: event.target.value as InteractionDirection,
          })
        }
      >
        {DIRECTIONS.map((direction) => (
          <option key={direction.value} value={direction.value}>
            {direction.label}
          </option>
        ))}
      </Select>

      <label className="block text-sm font-medium">
        Summary *
        <Input
          aria-label="Interaction summary"
          required
          maxLength={240}
          value={form.summary}
          onChange={(event) =>
            setForm({ ...form, summary: event.target.value })
          }
        />
      </label>

      <Textarea
        label="Details"
        rows={5}
        maxLength={10000}
        value={form.body}
        onChange={(event) =>
          setForm({ ...form, body: event.target.value })
        }
      />

      {isAdmin && (
        <Select
          label="Visibility"
          aria-label="Visibility"
          value={form.visibility}
          onChange={(event) =>
            setForm({
              ...form,
              visibility: event.target.value as InteractionVisibility,
            })
          }
        >
          <option value="operational">Operational</option>
          <option value="restricted">Restricted</option>
        </Select>
      )}

      <InteractionContactPicker
        facilityId={facilityId}
        selectedIds={form.contactIds}
        onChange={(contactIds) =>
          setForm((current) => ({
            ...current,
            contactIds,
          }))
        }
        disabled={submitting}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save Interaction"}
        </Button>
      </div>
    </form>
  );
}
