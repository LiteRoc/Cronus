import React, { useState } from "react";
import { TaskResult, WorkOrder } from "../../../types/types";
import PerformProcedureModal from "../modals/PerformProcedureModal";
import ViewTaskResultsModal from "../modals/ViewTaskResutsModal";

interface Props {
  workOrder: WorkOrder;
  onDeleteProcedure?: (procedureId: string) => void;
  onUpdateTask: (workOrderId: string, procedureId: string, taskResults: TaskResult[]) => void;
  onRefresh: () => void;
}

const ProcedureTaskResults: React.FC<Props> = ({ workOrder, onDeleteProcedure, onUpdateTask, onRefresh }) => {

  const [showPerformModal, setShowPerformModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);

  if (!workOrder.procedure) return null;

  return (
  <div className="space-y-6 mt-8">
    <div className="border p-4 rounded bg-gray-50 mb-4">
    <div className="flex justify-between items-center">
      <h3 className="text-lg font-semibold">
        🧪 Procedure: {workOrder.procedure?.name}
        {" "}
        <span className="text-sm text-gray-500">
          ({workOrder.taskResults?.length || 0} tasks)
        </span>
      </h3>
      <div className="flex gap-2">
        <button
          className="bg-blue-600 text-white px-3 py-1 rounded"
          onClick={() => setShowPerformModal(true)}
        >
          Perform Procedure
        </button>
        <button
          className="bg-gray-600 text-white px-3 py-1 rounded"
          onClick={() => setShowResultsModal(true)}
        >
          View Results
        </button>
        {workOrder.status !== "Closed" && (
          <button
            className="bg-red-600 text-white px-3 py-1 rounded"
            onClick={() => onDeleteProcedure?.(workOrder.procedure?._id as string)}
          >
            Remove
          </button>
        )}
      </div>
    </div>
    {showPerformModal && (
      <PerformProcedureModal
        isOpen={showPerformModal}
        procedure={workOrder.procedure}
        workOrderId={workOrder._id}
        onSave={onUpdateTask}
        onRefresh={onRefresh}
        onClose={() => setShowPerformModal(false)}
      />
    )}

    {showResultsModal && (
      <ViewTaskResultsModal
        isOpen={showResultsModal}
        tasks={workOrder.procedure?.tasks || []}
        taskResults={workOrder.taskResults || []}
        onClose={() => setShowResultsModal(false)}
      />
    )}
   </div>
  </div>
   
  );
};

export default ProcedureTaskResults;