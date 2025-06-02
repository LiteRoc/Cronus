import React, { useState } from "react";
import { TaskResult, Procedure } from "../../../types/types";
import "../../../styles/PerformProcedureModal.css";
//import { fetchTaskResults, saveTaskResults } from "../../../services/api";

interface PerformProcedureModalProps {
  isOpen: boolean;
  procedure: Procedure;
  workOrderId: string; // Include this to send in API call
  onSave: (updatedResults: TaskResult[]) => void;
  onClose: () => void;
}

const PerformProcedureModal: React.FC<PerformProcedureModalProps> = ({
  isOpen,
  procedure,
  //workOrderId,
  onSave,
  onClose,
}) => {
  const [taskResults, setTaskResults] = useState<TaskResult[]>(
    procedure?.taskResults || []
  );

  const handleResultChange = (taskId: string, value: boolean | number) => {
    setTaskResults((prev) =>
      prev.map((result) =>
        result.taskId === taskId ? { ...result, result: value } : result
      )
    );
  };

  const handleSave = async () => {
    try {
      onSave(taskResults);
      onClose();
    } catch (error) {
      console.error("Error saving procedure results:", error);
      alert("Failed to save procedure results. Please try again.");
    }
  };

  return isOpen ? (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">Perform Procedure: {procedure.name}</h2>
        <table className="task-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {/* Find the corresponding resutl */}
            {procedure.tasks.map((task) => {
              const result = taskResults.find((r) => r.taskId === task._id);
              return (
                <tr key={task._id}>
                  <td>{task.description || "Unnamed Task"}</td>
                  <td>
                    {typeof result?.result === "boolean" ? (
                      <select
                        value={result.result ? "Pass" : "Fail"}
                        onChange={(e) =>
                          handleResultChange(
                            task._id,
                            e.target.value === "Pass"
                          )
                        }
                      >
                        <option value="Pass">Pass</option>
                        <option value="Fail">Fail</option>
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={result?.result as number}
                        onChange={(e) =>
                          handleResultChange(task._id, Number(e.target.value))
                        }
                      />
                    )}
                  </td>
                </tr>
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