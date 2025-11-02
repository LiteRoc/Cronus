//src/pages/EditWorkOrder/components/ProcedureTaskResults.tsx

import React from "react";
import { WorkOrder } from "@/types";
import { FormCard } from "@/components/ui";

interface Props {
  workOrder: WorkOrder;
  onDeleteProcedure?: (procedureId: string) => void;
  onShowPerformModal: (procedureId: string) => void;
  onShowResultsModal: (procedureId: string) => void;
}

const ProcedureTaskResults: React.FC<Props> = ({
  workOrder,
  onDeleteProcedure,
  onShowPerformModal,
  onShowResultsModal,
}) => {
  if (!Array.isArray(workOrder.procedures) || workOrder.procedures.length === 0) return null;

  return (
    <FormCard title="Procedure">
      <div className="space-y-6 mt-8">
      {workOrder.procedures.map((procedure) => (
        <div
          key={procedure._id}
          className="border p-4 rounded bg-gray-50 shadow-sm"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              🧪 Procedure: {procedure.name}{" "}
              <span className="text-sm text-gray-500">
                ({procedure.taskResults?.length || 0} tasks)
              </span>
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                className="bg-blue-600 text-white px-3 py-1 rounded"
                onClick={() => onShowPerformModal(procedure._id)}
              >
                Perform Procedure
              </button>
              <button
                type="button"
                className="bg-gray-600 text-white px-3 py-1 rounded"
                onClick={() => onShowResultsModal(procedure._id)}
              >
                View Results
              </button>
              {workOrder.status !== "Closed" && (
                <button
                  type="button"
                  className="bg-red-600 text-white px-3 py-1 rounded"
                  onClick={() => onDeleteProcedure?.(procedure._id)}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      </div>
    </FormCard>
    
  );
};

export default ProcedureTaskResults;