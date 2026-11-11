import { useEffect, useRef, useState, type FormEvent } from "react";
import { effectiveTimeZone } from "@/pages/FollowUps/dateTime";
import {
  createInteraction,
  getInteraction,
  getInteractions,
} from "@/services/interactionAPI";

import Modal from "@/components/Modal";
import { Button } from "@/components/ui";

import type {
  Interaction,
  InteractionDirection,
  InteractionInput,
  InteractionType,
} from "@/types/Interaction";

import InteractionDetail from "./InteractionDetail";
import InteractionForm from "./InteractionForm";

interface Props {
  facilityId: string | null;
  facilityTimezone?: string;
  isAdmin: boolean;
}

export default function InteractionsPage({
  facilityId,
  facilityTimezone,
  isAdmin,
}: Props) {
  const [items, setItems] = useState<Interaction[]>([]);
  const [selected, setSelected] = useState<Interaction | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [type, setType] = useState<InteractionType | "">("");
  const [direction, setDirection] =
    useState<InteractionDirection | "">("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const createGeneration = useRef(0);
  const createInFlight = useRef(false);

  const listGeneration = useRef(0);
  const detailGeneration = useRef(0);

  const facilityRef = useRef(facilityId);
  facilityRef.current = facilityId;

  useEffect(() => {
    const generation = ++listGeneration.current;

    // A new list invalidates the previous detail selection.
    ++detailGeneration.current;
    setSelected(null);
    setItems([]);
    setTotal(0);
    setTotalPages(0);
    setDetailLoading(false);
    setError(null);

    if (!facilityId) {
      setLoading(false);
      return;
    }

    const requestedFacility = facilityId;
    setLoading(true);

    getInteractions(requestedFacility, {
      search: search || undefined,
      type: type || undefined,
      direction: direction || undefined,
      page,
      limit: 20,
    })
      .then((result) => {
        if (
          generation !== listGeneration.current ||
          facilityRef.current !== requestedFacility
        ) {
          return;
        }

        setItems(result.interactions);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .catch(() => {
        if (
          generation !== listGeneration.current ||
          facilityRef.current !== requestedFacility
        ) {
          return;
        }

        setError("Unable to load Interactions.");
      })
      .finally(() => {
        if (
          generation === listGeneration.current &&
          facilityRef.current === requestedFacility
        ) {
          setLoading(false);
        }
      });

    return () => {
      ++listGeneration.current;
      ++detailGeneration.current;
    };
  }, [facilityId, search, type, direction, page, refreshVersion]);

  useEffect(() => {
    return () => {
      ++createGeneration.current;
      createInFlight.current = false;
    };
  }, [facilityId, isAdmin]);

  const closeCreate = () => {
    if (createInFlight.current) return;

    setShowCreate(false);
    setCreateError(null);
  };

  const saveNewInteraction = async (
    input: Partial<InteractionInput>,
  ): Promise<void> => {
    if (!facilityId || createInFlight.current) return;

    if (
      !input.type ||
      !input.occurredAt ||
      !input.summary ||
      !input.direction
    ) {
      setCreateError("Complete the required Interaction fields.");
      return;
    }

    const requestedFacility = facilityId;
    const generation = ++createGeneration.current;

    const createInput: InteractionInput = {
      type: input.type,
      occurredAt: input.occurredAt,
      summary: input.summary,
      direction: input.direction,
      body: input.body,
      visibility: isAdmin ? input.visibility : "operational",
      contactIds: input.contactIds,
    };

    createInFlight.current = true;
    setCreateSubmitting(true);
    setCreateError(null);

    try {
      await createInteraction(requestedFacility, createInput);

      if (
        generation !== createGeneration.current ||
        facilityRef.current !== requestedFacility
      ) {
        return;
      }

      setShowCreate(false);
      setCreateError(null);

      // Reset filters so the refreshed first page can show
      // newly created activity according to backend ordering.
      setSearchInput("");
      setSearch("");
      setType("");
      setDirection("");
      setPage(1);

      setRefreshVersion((current) => current + 1);
    } catch {
      if (
        generation !== createGeneration.current ||
        facilityRef.current !== requestedFacility
      ) {
        return;
      }

      // Keep the form mounted, preserving the user's input.
      setCreateError(
        "Unable to create the Interaction. Check the information and try again.",
      );
    } finally {
      if (
        generation === createGeneration.current &&
        facilityRef.current === requestedFacility
      ) {
        createInFlight.current = false;
        setCreateSubmitting(false);
      }
    }
  };

  const openInteraction = async (interactionId: string) => {
    if (!facilityId) return;

    const requestedFacility = facilityId;
    const generation = ++detailGeneration.current;

    setSelected(null);
    setDetailLoading(true);
    setError(null);

    try {
      const interaction = await getInteraction(
        requestedFacility,
        interactionId,
      );

      if (
        generation !== detailGeneration.current ||
        facilityRef.current !== requestedFacility
      ) {
        return;
      }

      if (
        interaction.facilityId !== requestedFacility ||
        (!isAdmin && interaction.visibility !== "operational")
      ) {
        setError("This Interaction is unavailable.");
        return;
      }

      setSelected(interaction);
    } catch {
      if (
        generation !== detailGeneration.current ||
        facilityRef.current !== requestedFacility
      ) {
        return;
      }

      setError("Unable to load Interaction details.");
    } finally {
      if (
        generation === detailGeneration.current &&
        facilityRef.current === requestedFacility
      ) {
        setDetailLoading(false);
      }
    }
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  if (!facilityId) {
    return (
      <div className="p-6" role="status">
        Select a Facility to view Interactions.
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <header>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Interactions</h1>

          <Button
            type="button"
            onClick={() => {
              setCreateError(null);
              setShowCreate(true);
            }}
          >
            New Interaction
          </Button>
        </div>
        <p className="text-sm text-gray-600">
          Facility-scoped CRM activity history
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <form onSubmit={submitSearch} className="flex gap-2">
          <input
            aria-label="Search Interactions"
            className="rounded border px-3 py-2"
            placeholder="Search activity"
            value={searchInput}
            onChange={(event) =>
              setSearchInput(event.target.value)
            }
          />
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white"
            type="submit"
          >
            Search
          </button>
        </form>

        <select
          aria-label="Filter by type"
          className="rounded border px-3 py-2"
          value={type}
          onChange={(event) => {
            setPage(1);
            setType(event.target.value as InteractionType | "");
          }}
        >
          <option value="">All types</option>
          <option value="meeting">Meeting</option>
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="site_visit">Site Visit</option>
          <option value="note">Note</option>
        </select>

        <select
          aria-label="Filter by direction"
          className="rounded border px-3 py-2"
          value={direction}
          onChange={(event) => {
            setPage(1);
            setDirection(
              event.target.value as InteractionDirection | "",
            );
          }}
        >
          <option value="">All directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
          <option value="internal">Internal</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Activity history" className="space-y-3">
          <h2 className="font-semibold">
            Activity History ({total})
          </h2>

          {loading ? (
            <p role="status">Loading Interactions…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">
              No Interactions found.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((interaction) => (
                <button
                  key={interaction._id}
                  type="button"
                  className="w-full rounded border bg-white p-4 text-left hover:bg-gray-50"
                  onClick={() =>
                    void openInteraction(interaction._id)
                  }
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">
                      {interaction.summary}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Intl.DateTimeFormat(undefined, {
                        timeZone: effectiveTimeZone(facilityTimezone),
                        dateStyle: "medium",
                      }).format(new Date(interaction.occurredAt))}
                    </span>
                  </div>

                  <p className="mt-1 text-xs capitalize text-gray-500">
                    {interaction.type.replace("_", " ")}
                    {" · "}
                    {interaction.direction}
                  </p>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>

            <span className="text-sm">
              Page {page} of {Math.max(totalPages, 1)}
            </span>

            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </section>

        <section aria-label="Interaction details">
          {detailLoading ? (
            <p role="status">Loading details…</p>
          ) : selected ? (
            <InteractionDetail
              interaction={selected}
              facilityTimezone={facilityTimezone}
              isAdmin={isAdmin}
            />
          ) : (
            <div className="rounded border bg-white p-6 text-sm text-gray-500">
              Select an Interaction to view its details.
            </div>
          )}
        </section>
      </div>

      <Modal
        isOpen={showCreate}
        onClose={closeCreate}
        title="New Interaction"
        className="relative max-h-[90vh] w-[min(720px,calc(100vw-2rem))] overflow-y-auto"
      >
        <InteractionForm
          key={facilityId}
          interaction={null}
          facilityId={facilityId}
          facilityTimezone={facilityTimezone}
          timezoneLabel={`Time zone: ${effectiveTimeZone(facilityTimezone)}`}
          isAdmin={isAdmin}
          submitting={createSubmitting}
          error={createError}
          onCancel={closeCreate}
          onSubmit={saveNewInteraction}
        />
      </Modal>
    </div>
  );
}
