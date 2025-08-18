import React, { useEffect, useState } from "react";
import { TaskResult, Procedure } from "../../../types/types";
import { useUser } from "../../../context/UserContext"
import "../../../styles/PerformProcedureModal.css";


interface PerformProcedureModalProps {
  isOpen: boolean;
  procedure?: Procedure;
  workOrderId: string; // Include this to send in API call
  onSave: (workOrderId: string, procedureId: string, taskResults: TaskResult[]) => void;
  onRefresh: () => void;
  onClose: () => void;
}

const PerformProcedureModal: React.FC<PerformProcedureModalProps> = ({
  isOpen,
  procedure,
  workOrderId,
  onSave,
  onRefresh,
  onClose,
}) => {
  const [taskResults, setTaskResults] = useState<TaskResult[]>(
    procedure?.taskResults || []
  );

  const { user } = useUser();

  useEffect(() => {
    if (procedure?.tasks) {
      setTaskResults(
        procedure.tasks.map((task) => ({
          taskId: task._id,
          result: null, // or false / 0 depending on type
          submittedBy: "", // you can set this on save
          submittedByName: "",
          unit: "",
          timestamp: new Date().toISOString(),
        }))
      );
    }
  }, [procedure]);

  const handleResultChange = (taskId: string, value: boolean | number | string ) => {
    setTaskResults((prev) =>
      prev.map((result) =>
        result.taskId === taskId ? { ...result, result: value } : result
      )
    );
  };

  const handleSave = async () => {
    try {
      const userId = user?.id || ""; // Pull from context or props
      const updatedResults = taskResults.map((r) => ({
        ...r,
        submittedBy: userId,
        submittedByName: user?.name || user?.username || "Unknown User",
        timestamp: new Date().toISOString(),
      }));

      if (!procedure) return null;

      onSave(workOrderId, procedure._id, updatedResults);
      onRefresh();
      onClose();
    } catch (error) {
      console.error("Error saving procedure results:", error);
      alert("Failed to save procedure results. Please try again.");
    }
  };

  // Helper function to safely extract the correct input value
  const getSafeValue = (
    result: boolean | number | string | null | undefined,
    type: "Pass/Fail" | "Measurement" | "Comment"
  ): string | number => {
    if (type === "Measurement" && typeof result === "number") {
      return result;
    }
    if (type === "Comment" && typeof result === "string") {
      return result;
    }
    return ""; // Handles Pass/Fail and default fallback
  };
  
  return isOpen ? (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">Perform Procedure: {procedure?.name}</h2>
        <table className="task-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {/* Rendering input fields for each task */}
            {procedure?.tasks.map((task) => {
              const matchingResult = taskResults.find((r) => r.taskId === task._id);
              const normalizedType = task.type?.toLowerCase();

              //console.log("Rendering task:", task.description, "→ type:", normalizedType);

              return (
                <div key={task._id} className="mb-4">
                  <label className="block font-medium mb-1">{task.description}</label>

                  {normalizedType === "pass/fail" ? (
                    <select
                      value={
                        matchingResult?.result === true
                          ? "Pass"
                          : matchingResult?.result === false
                          ? "Fail"
                          : ""
                      }
                      onChange={(e) =>
                        handleResultChange(task._id, e.target.value === "Pass")
                      }
                      className="border rounded px-2 py-1 w-full"
                    >
                      <option value="">Select</option>
                      <option value="Pass">Pass</option>
                      <option value="Fail">Fail</option>
                    </select>
                  ) : normalizedType === "measurement" ? (
                    <input
                      type="number"
                      min={task.minValue}
                      max={task.maxValue}
                      value={getSafeValue(matchingResult?.result, task.type)}
                      onChange={(e) =>
                        handleResultChange(task._id, parseFloat(e.target.value))
                      }
                      className="border rounded px-2 py-1 w-full"
                    />
                  ) : (
                    <textarea
                      value={getSafeValue(matchingResult?.result, task.type) as string}
                      onChange={(e) => handleResultChange(task._id, e.target.value)}
                      className="border rounded px-2 py-1 w-full"
                    />
                  )}
                </div>
              );
            })}

          </tbody>
        </table>
        <div className="modal-actions">
          <button className="btn btn-save" onClick={handleSave}>
            Save
          </button>
          <button className="btn btn-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null;
};

export default PerformProcedureModal;