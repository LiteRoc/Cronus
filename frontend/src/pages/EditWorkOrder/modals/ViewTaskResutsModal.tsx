//src/pages/EditWorkOrder/modals/ViewTaskResultsModal.tsx

import React from "react";
import { TaskResult } from "@/types";
import Modal from "@/components/Modal";

interface ViewTaskModalProps {
  onClose: () => void;
  taskResults?: TaskResult[];
}

const ViewTaskModal: React.FC<ViewTaskModalProps> = ({ onClose, taskResults }) => {
  if (!taskResults || !Array.isArray(taskResults)) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2 className="modal-title">No procedure results found</h2>
          <div className="modal-actions">
            <button className="btn btn-cancel" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  console.log("🧪 Results being rendered:", taskResults);

  return (
    <Modal isOpen={true} onClose={onClose} title="View Procedure Results">
        <table className="task-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Result</th>
              <th>Submitted By</th>
            </tr>
          </thead>
          <tbody>
            {taskResults.map((result) => {
              const normalizedType = result.type?.toLowerCase();
              let displayResult = "—";

              if (normalizedType === "pass/fail" || normalizedType === "passfail") {
                displayResult = result.value === true ? "✅ Pass" :
                                result.value === false ? "❌ Fail" :
                                "Pending";
              } else if (normalizedType === "measurement" || normalizedType === "measure") {
                displayResult = result.value != null
                  ? `${result.value}${result.unitOfMeasure ? ' ' + result.unitOfMeasure : ''}`
                  : "Pending";
              } else if (normalizedType === "comment") {
                displayResult = result.value != null ? String(result.value) : "Pending";
              }

              return (
                <tr key={result.taskId}>
                  <td className="align-top pr-4">{result.label}</td>
                  <td className="align-top pr-4">{displayResult}</td>
                  <td className="align-top pr-4">
                    <div className="text-xs text-gray-600 mt-1">
                      by <strong>{result.submittedBy || "Unknown"}</strong><br />
                      at {result.submittedAt ? new Date(result.submittedAt).toLocaleString() : "N/A"}
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
      </Modal>
  );
};

export default ViewTaskModal;