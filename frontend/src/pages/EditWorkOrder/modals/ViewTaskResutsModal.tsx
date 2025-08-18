import React from "react";
import { Task, TaskResult } from "../../../types/types";

interface ViewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  taskResults: TaskResult[];
}

const ViewTaskModal: React.FC<ViewTaskModalProps> = ({ isOpen, onClose, tasks, taskResults }) => {
  if (!isOpen) return null;

  //console.log("🧪 Results being rendered:", taskResults);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">View Procedure Results</h2>
        <table className="task-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {taskResults.map((result) => {
              const task = tasks.find((t) => t._id === result.taskId);
              const isPassFail = typeof result.result === "boolean";
              const isMeasurement = typeof result.result === "number";
              //const isComment = typeof result.result === "string" && !isPassFail;

              return (
                <tr key={result._id}>
                  <td>{task?.description}</td>
                  <td>
                    {isPassFail ? (
                      <span>{result.result ? "✅ Pass" : "❌ Fail"}</span>
                    ) : isMeasurement ? (
                      <span>
                        {result.result}
                        {task?.unit ? ` ${task.unit}` : ""}
                      </span>
                    ) : (
                      <span>{result.result}</span>
                    )}
                    <div className="text-xs text-gray-600 mt-1">
                      by <strong>{result.submittedByName}</strong><br />
                      at {new Date(result.timestamp).toLocaleString()}
                    </div>
                  </td>
                </tr>
              );
            })}

          </tbody>
        </table>
        <div className="modal-actions">
          <button className="btn btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ViewTaskModal;