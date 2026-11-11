import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui";
import { getContacts } from "@/services/contactAPI";
import type { Contact } from "@/types/Contact";

interface Props {
  facilityId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

const PAGE_SIZE = 20;

const contactName = (contact: Contact) =>
  `${contact.firstName} ${contact.lastName}`.trim();

export default function InteractionContactPicker({
  facilityId,
  selectedIds,
  onChange,
  disabled = false,
}: Props) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [knownContacts, setKnownContacts] = useState<Record<string, Contact>>({});

  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [stateFacilityId, setStateFacilityId] = useState(facilityId);
  const generation = useRef(0);
  const facilityRef = useRef(facilityId);

  facilityRef.current = facilityId;

  // Clear previously displayed Contact information during rendering,
  // before effects or responses from the new Facility run.
  if (stateFacilityId !== facilityId) {
    generation.current += 1;

    setStateFacilityId(facilityId);
    setContacts([]);
    setKnownContacts({});
    setSearchInput("");
    setSearch("");
    setPage(1);
    setTotalPages(0);
    setLoading(false);
    setError(false);
  }

  useEffect(() => {
    if (!facilityId) return;

    const requestId = ++generation.current;

    setLoading(true);
    setError(false);

    getContacts(facilityId, {
      search: search || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (
          requestId !== generation.current ||
          facilityRef.current !== facilityId
        ) {
          return;
        }

        setContacts(result.contacts);
        setTotalPages(result.totalPages);

        setKnownContacts((previous) => {
          const updated = { ...previous };

          for (const contact of result.contacts) {
            if (
              contact.status === "active" &&
              contact.facilityIds.includes(facilityId)
            ) {
              updated[contact._id] = contact;
            }
          }

          return updated;
        });
      })
      .catch(() => {
        if (
          requestId !== generation.current ||
          facilityRef.current !== facilityId
        ) {
          return;
        }

        setContacts([]);
        setTotalPages(0);
        setError(true);
      })
      .finally(() => {
        if (
          requestId === generation.current &&
          facilityRef.current === facilityId
        ) {
          setLoading(false);
        }
      });

    return () => {
      generation.current += 1;
    };
  }, [facilityId, search, page]);

  const toggle = (id: string) => {
    if (disabled) return;

    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selected) => selected !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <fieldset
      className="space-y-3 rounded-lg border border-gray-200 p-4"
      disabled={disabled}
    >
      <legend className="px-1 text-sm font-semibold">
        Linked Contacts
      </legend>

      <p className="text-xs text-gray-600">
        Select the Contacts involved in this Interaction.
      </p>

      {selectedIds.length > 0 && (
        <div aria-label="Selected Contacts" className="space-y-2">
          {selectedIds.map((id, index) => (
            <div
              key={id}
              className="flex items-center justify-between rounded bg-blue-50 p-2 text-sm"
            >
              <span>
                {knownContacts[id]
                  ? contactName(knownContacts[id])
                  : `Linked Contact ${index + 1}`}
              </span>

              <Button
                type="button"
                variant="outline"
                onClick={() => toggle(id)}
                aria-label={`Remove linked Contact ${index + 1}`}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <div role="search" className="flex gap-2">
        <input
          aria-label="Search linked Contacts"
          className="w-full rounded border px-3 py-2 text-sm"
          maxLength={200}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search Contacts"
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          Search
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          Contacts could not be loaded.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading Contacts…</p>
      ) : (
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {contacts.map((contact) => {
            const eligible =
              contact.status === "active" &&
              contact.facilityIds.includes(facilityId);

            return (
              <label
                key={contact._id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(contact._id)}
                  disabled={!eligible || disabled}
                  onChange={() => toggle(contact._id)}
                />

                <span>
                  {contactName(contact)}
                  {!eligible && " (Unavailable)"}
                </span>
              </label>
            );
          })}

          {!contacts.length && (
            <p className="text-sm text-gray-500">
              No Contacts found.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={page <= 1 || loading}
          onClick={() => setPage((current) => current - 1)}
        >
          Previous
        </Button>

        <span className="text-xs text-gray-600">
          Page {page} of {Math.max(1, totalPages)}
        </span>

        <Button
          type="button"
          variant="outline"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </Button>
      </div>
    </fieldset>
  );
}
