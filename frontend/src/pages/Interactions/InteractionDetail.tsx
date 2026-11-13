import type { Interaction } from "@/types/Interaction";
import { displayDueAt } from "@/pages/FollowUps/dateTime";

interface Props {
  interaction: Interaction;
  facilityTimezone?: string;
  isAdmin: boolean;
}

export default function InteractionDetail({
  interaction,
  facilityTimezone,
  isAdmin,
}: Props) {

  return (
    <section className="space-y-4 rounded-lg border bg-white p-5">
      <div>
        <h2 className="text-xl font-semibold">
          {interaction.summary}
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          {displayDueAt(interaction.occurredAt, facilityTimezone)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-medium text-gray-500">Type</dt>
          <dd className="capitalize">
            {interaction.type.replace("_", " ")}
          </dd>
        </div>

        <div>
          <dt className="font-medium text-gray-500">Direction</dt>
          <dd className="capitalize">{interaction.direction}</dd>
        </div>

        {isAdmin && (
          <div>
            <dt className="font-medium text-gray-500">Visibility</dt>
            <dd className="capitalize">
              {interaction.visibility}
            </dd>
          </div>
        )}

        <div>
          <dt className="font-medium text-gray-500">
            Linked Contacts
          </dt>
          <dd>{interaction.contactIds.length}</dd>
        </div>
      </dl>

      <div>
        <h3 className="text-sm font-semibold">Details</h3>

        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
          {interaction.body || "No additional details recorded."}
        </p>
      </div>

      <div className="border-t pt-4 text-xs text-gray-500">
        <p>
          Created: {displayDueAt(interaction.createdAt, facilityTimezone)}
        </p>
        <p>
          Updated: {displayDueAt(interaction.updatedAt, facilityTimezone)}
        </p>
      </div>
    </section>
  );
}