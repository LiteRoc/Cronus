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
            {tasks.map((task) => {
              const result = taskResults.find((r) => r.taskId?.toString() === task._id?.toString());
              return (
                <tr key={task._id}>
                  <td>{task.description}</td>
                  <td>
                    {result?.result === undefined || result?.result === null ? (
                      "Not recorded"
                    ) : (
                      <>
                        {typeof result.result === "boolean"
                          ? result.result
                            ? "✅ Pass"
                            : "❌ Fail"
                          : `🔢 ${result.result}`}
                        <br />
                        <small>
                          by <strong>{result.submittedByName || result.submittedBy}</strong><br />
                          at {new Date(result.timestamp).toLocaleString()}
                        </small>
                      </>
                    )}
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