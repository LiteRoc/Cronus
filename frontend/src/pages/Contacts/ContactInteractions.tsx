import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui";
import { effectiveTimeZone } from "@/pages/FollowUps/dateTime";
import { getInteractions } from "@/services/interactionAPI";
import type { Interaction } from "@/types/Interaction";

interface Props {
  contactId: string;
  facilityId: string | null;
  facilityTimezone?: string;
  isAdmin: boolean;
}

export default function ContactInteractions({
  contactId,
  facilityId,
  facilityTimezone,
  isAdmin,
}: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    setItems([]);
    setError(false);
    setLoading(true);

    if (!facilityId || !contactId) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    getInteractions(facilityId, {
      contactId,
      page: 1,
      limit: 5,
    })
      .then((result) => {
        if (!active) return;

        // Defense in depth: never render records belonging to
        // another Facility, Contact, or unauthorized visibility.
        setItems(
          result.interactions.filter(
            (item) =>
              item.facilityId === facilityId &&
              item.contactIds.includes(contactId) &&
              item.archivedAt === null &&
              (isAdmin || item.visibility === "operational"),
          ),
        );
      })
      .catch(() => {
        if (!active) return;

        setItems([]);
        setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [contactId, facilityId, isAdmin]);

  const timezone = effectiveTimeZone(facilityTimezone);

  return (
    <section
      aria-label="Recent Interactions"
      className="border-t pt-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Recent Interactions
        </h3>

        <span className="text-xs text-gray-500">
          Up to 5
        </span>
      </div>

      {loading ? (
        <p role="status" className="mt-2 text-sm text-gray-500">
          Loading Interactions…
        </p>
      ) : error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          Recent Interactions could not be loaded.
        </p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          No Interactions recorded for this Contact.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li
              key={item._id}
              className="rounded border p-3 text-sm"
            >
              <div className="font-medium">
                {item.summary}
              </div>

              <div className="mt-1 text-xs text-gray-500">
                {new Intl.DateTimeFormat("en-US", {
                  timeZone: timezone,
                  dateStyle: "medium",
                }).format(new Date(item.occurredAt))}
                {" · "}
                {item.type.replace("_", " ")}
              </div>
            </li>
          ))}
        </ul>
      )}

      {facilityId && contactId && (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate(
                `/interactions?contactId=${encodeURIComponent(contactId)}`,
              )
            }
          >
            View All Interactions
          </Button>
        </div>
      )}
    </section>
  );
}
