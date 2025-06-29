import React from "react";
import { WorkOrder } from "../../../types/types";

interface Props {
  workOrder: WorkOrder;
  onChange: (field: keyof WorkOrder, value: any) => void;
}

const WorkOrderFormFields: React.FC<Props> = ({ workOrder, onChange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Description */}
      <div>
        <label className="block text-sm font-medium">Description</label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={workOrder.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium">Type</label>
        <select
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={workOrder.workOrderType}
          onChange={(e) => onChange("workOrderType", e.target.value)}
        >
          <option value="">Select Type</option>
          <option value="Corrective Maintenance">Corrective Maintenance</option>
          <option value="Planned Maintenance">Planned Maintenance</option>
        </select>
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium">Status</label>
        <select
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={workOrder.status}
          onChange={(e) => onChange("status", e.target.value)}
        >
          <option value="">Select Status</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Complete">Closed</option>
          <option value="Cancelled">Overdue</option>
        </select>
      </div>

      {/* Assigned To */}
      <div>
        <label className="block text-sm font-medium">Assigned To</label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={workOrder.assignedTo?._id || ""}
          onChange={(e) => onChange("assignedTo", { _id: e.target.value })} // or set full user object if needed
        />
      </div>

      {/* Scheduled Date */}
      <div>
        <label className="block text-sm font-medium">Scheduled Date</label>
        <input
          type="date"
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={workOrder.scheduledDate?.slice(0, 10) || ""}
          onChange={(e) => onChange("scheduledDate", e.target.value)}
        />
      </div>

      {/* Due Date */}
      <div>
        <label className="block text-sm font-medium">Due Date</label>
        <input
          type="date"
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={workOrder.dueDate?.slice(0, 10) || ""}
          onChange={(e) => onChange("dueDate", e.target.value)}
        />
      </div>
    </div>
  );
};

export default WorkOrderFormFields;