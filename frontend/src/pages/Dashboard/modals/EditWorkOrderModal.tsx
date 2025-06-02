import React, { useState } from "react";
import { WorkOrder, TimeLog, Part } from "../../../types/types";
import { formatDateForInput } from "../../../utils/DashboardUtils";

interface EditWorkOrderModalProps {
  workOrder: WorkOrder | null;
  onClose: () => void;
  onSave: (updatedWorkOrder: WorkOrder) => void;
}

const EditWorkOrderModal: React.FC<EditWorkOrderModalProps> = ({
  workOrder,
  onClose,
  onSave,
}) => {
  const [editedWorkOrder, setEditedWorkOrder] = useState<WorkOrder | null>(
    workOrder
  );

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setEditedWorkOrder((prev) => ({
      ...prev as WorkOrder,
      [name]: value,
    }));
  };

  // Handlers for Time Logs, Travel Logs, and Parts
  const handleAddTimeLog = () => {
    const newLog: TimeLog = {
      _id: Date.now().toString(),
      userId: "newUser", // Replace with actual user
      timeSpent: 0,
      description: "New Time Log",
      timestamp: new Date().toISOString(),
    };
    setEditedWorkOrder((prev) => ({
      ...prev as WorkOrder,
      timeLogs: [...(prev?.timeLogs || []), newLog],
    }));
  };

  const handleEditTimeLog = (index: number, field: string, value: string | number) => {
    setEditedWorkOrder((prev) => {
      const updatedLogs = [...(prev?.timeLogs || [])];
      updatedLogs[index] = { ...updatedLogs[index], [field]: value };
      return { ...prev as WorkOrder, timeLogs: updatedLogs };
    });
  };

  const handleDeleteTimeLog = (index: number) => {
    setEditedWorkOrder((prev) => {
      const updatedLogs = [...(prev?.timeLogs || [])];
      updatedLogs.splice(index, 1); // Remove the log at the given index
      return { ...prev as WorkOrder, timeLogs: updatedLogs };
    });
  };  

  const handleAddPart = () => {
    const newPart: Part = {
      _id: Date.now().toString(),
      partNumber: "NEW_PART",
      description: "New Part description",
      quantity: 1,
    };
    setEditedWorkOrder((prev) => ({
      ...prev as WorkOrder,
      partsUsed: [...(prev?.partsUsed || []), newPart],
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editedWorkOrder) {
      onSave(editedWorkOrder);
      onClose();
    }
  };

  if (!workOrder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-4xl overflow-auto max-h-[90vh]">
        <h2 className="text-2xl font-semibold mb-4">Edit Work Order</h2>
        <form onSubmit={handleSave}>
          {/* Basic Details */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block font-medium mb-1">Description</label>
              <textarea
                name="description"
                className="w-full border rounded p-2"
                value={editedWorkOrder?.description || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Status</label>
              <select
                name="status"
                className="w-full border rounded p-2"
                value={editedWorkOrder?.status || ""}
                onChange={handleInputChange}
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Scheduled Date</label>
              <input
                type="date"
                name="scheduledDate"
                className="w-full border rounded p-2"
                value={
                  editedWorkOrder?.scheduledDate
                    ? formatDateForInput(editedWorkOrder.scheduledDate)
                    : ""
                }
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Due Date</label>
              <input
                type="date"
                name="dueDate"
                className="w-full border rounded p-2"
                value={
                  editedWorkOrder?.dueDate
                    ? formatDateForInput(editedWorkOrder.dueDate)
                    : ""
                }
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* Time Logs */}
          <section className="mt-4">
            <h3 className="font-semibold mb-2 flex justify-between">
              Time Logs
              <button
                type="button"
                onClick={handleAddTimeLog}
                className="text-blue-500 underline"
              >
                + Add Time Log
              </button>
            </h3>

            {/* Table Structure */}
            <div className="overflow-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border p-2">Date</th>
                    <th className="border p-2">Tech</th>
                    <th className="border p-2">Hours</th>
                    <th className="border p-2">Description</th>
                    <th className="border p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editedWorkOrder?.timeLogs?.map((log, index) => (
                    <tr key={log._id} className="hover:bg-gray-100">
                      <td className="border p-2">{log.timestamp.split("T")[0]}</td>
                      <td className="border p-2">{log.userId}</td> {/* Replace with actual tech name */}
                      <td className="border p-2">
                        <input
                          type="number"
                          value={log.timeSpent}
                          onChange={(e) =>
                            handleEditTimeLog(index, "timeSpent", Number(e.target.value))
                          }
                          className="border rounded p-1 w-16"
                        />
                      </td>
                      <td className="border p-2">
                        <input
                          type="text"
                          value={log.description}
                          onChange={(e) =>
                            handleEditTimeLog(index, "description", e.target.value)
                          }
                          className="border rounded p-1 w-full"
                        />
                      </td>
                      <td className="border p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteTimeLog(index)}
                          className="text-red-500 underline mr-2"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="text-blue-500 underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {editedWorkOrder?.timeLogs?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-gray-500 p-2">
                        No Time Logs Added
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Parts Used */}
          <section className="mt-4">
            <h3 className="font-semibold mb-2 flex justify-between">
              Parts Used
              <button
                type="button"
                onClick={handleAddPart}
                className="text-blue-500 underline"
              >
                + Add Part
              </button>
            </h3>
            {editedWorkOrder?.partsUsed?.map((part) => (
              <div key={part._id} className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  value={part._id}
                  className="border p-2 rounded"
                  readOnly
                />
                <input
                  type="number"
                  value={part.quantity}
                  className="border p-2 rounded"
                  readOnly
                />
              </div>
            ))}
          </section>

          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditWorkOrderModal;