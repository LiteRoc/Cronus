import React from "react";
import { WorkOrder } from "@/types";
import { Button, FormCard } from "@/components/ui";

interface Props {
  workOrder: WorkOrder;
  onDeletePart?: (partId: string) => void;
  onShowAddPartModal: () => void;
}

const PartsUsedSection: React.FC<Props> = ({
  workOrder,
  onDeletePart,
  onShowAddPartModal,
}) => {
  const partsUsed = workOrder.partsUsed ?? [];

  return (
    <FormCard title="Parts">
      {/* Header with Add button */}
      <div className="flex justify-end mb-3">
        <Button
          type="button"
          className="bg-blue-600 text-white px-3 py-1 rounded"
          onClick={() => onShowAddPartModal()}
        >
          + Add Part
        </Button>
      </div>

      {/* Parts list */}
      <div className="space-y-4">
        {partsUsed.length === 0 ? (
          <p className="text-gray-500 italic">No parts have been added yet.</p>
        ) : (
          partsUsed.map((p, index) => {
            // Handle populated vs. unpopulated partId
            const part =
              typeof p.partId === "object" && p.partId !== null
                ? p.partId
                : null;

            return (
              <div
                key={p._id || `temp-${index}`}
                className="border p-4 rounded bg-gray-50 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  {/* Part info */}
                  <div>
                    <h3 className="text-lg font-semibold text-blue-700">
                      {part?.partNumber
                        ? `Part: ${part.partNumber}`
                        : `Part ID: ${p.partId}`}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {part?.description ?? "No description available"}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Quantity Used:{" "}
                      <span className="font-medium text-gray-700">
                        {p.quantity ?? 0}
                      </span>
                    </p>
                  </div>

                  {/* Remove button */}
                  {workOrder.status !== "Completed" && workOrder.status !== "Closed" && (
                    <Button
                      type="button"
                      className="bg-red-600 text-white px-3 py-1 rounded h-fit"
                      onClick={() => {
                        const id =
                          typeof p.partId === "object"
                            ? p.partId._id // populated case
                            : p.partId;    // string ID case
                        onDeletePart?.(id!);
                      }}
                    >
                      - Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </FormCard>
  );
};

export default PartsUsedSection;
