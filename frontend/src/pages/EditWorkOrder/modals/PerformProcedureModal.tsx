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
          timestamp: new Date().toISOString(),
        }))
      );
    }
  }, [procedure]);

  const handleResultChange = (taskId: string, value: boolean | number) => {
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
            {/* Find the corresponding resutl */}
            {procedure?.tasks.map((task) => {
              const result = taskResults.find((r) => r.taskId === task._id);
              return (
                <tr key={task._id}>
                  <td>{task.description || "Unnamed Task"}</td>
                  <td>
                    {typeof result?.result === "boolean" ? (
                      <select
                        value={(result.result ? "Pass" : "Fail")}
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
                        value={result?.result ?? "" }
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