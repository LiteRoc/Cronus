import React from "react";
import { WorkOrder } from "@/types";
import { Input, Select, FormCard, Label } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { formatISODate } from "@/utils/dateUtils";

interface Props {
  workOrder: WorkOrder;
  isReadOnly: boolean;
  handleChange: (field: keyof WorkOrder, value: any) => void;
  updateField: (path: string, value: any) => void;
}

const WorkOrderFormFields: React.FC<Props> = ({ workOrder, isReadOnly, handleChange, updateField }) => {
  if (!workOrder || !workOrder.assetId) {
    return <div className="p-4 text-sm text-gray-500">Loading Work Order ...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* 🔧 Work Order Details */}
      <FormCard title="Work Order Details">
        <div className="space-y-2">
          <Label htmlFor="workOrderNumber">Work Order #</Label>
          <Input id="workOrderNumber" value={workOrder.workOrderNumber} disabled readOnly />

          <Label htmlFor="requestDate">Request Date</Label>
          <Input id="requestDate" value={formatISODate(workOrder.requestDate)} disabled readOnly />

          <Label htmlFor="createdAt">Created At</Label>
          <Input id="createdAt" value={formatISODate(workOrder.createdAt)} disabled readOnly />

          <Label htmlFor="scheduledDate">Scheduled Date</Label>
          {isReadOnly ? (
            <Input id="scheduledDate" value={formatISODate(workOrder.scheduledDate)} disabled readOnly />
          ) : (
            <DatePicker
              value={workOrder.scheduledDate ? new Date(workOrder.scheduledDate) : null}
              onChange={(date) => handleChange("scheduledDate", date?.toISOString() || "")}
              disabled={isReadOnly}
            />
          )}

          <Label htmlFor="completionDate">Completion Date</Label>
          {isReadOnly ? (
            <Input id="completionDate" value={formatISODate(workOrder.completionDate)} disabled readOnly />
          ) : (
            <DatePicker
              value={workOrder.completionDate ? new Date(workOrder.completionDate) : null}
              onChange={(date) => handleChange("completionDate", date?.toISOString() || "")}
              disabled={isReadOnly}
            />
          )}

          <Label htmlFor="description">Description</Label>
          <Input id="description" value={workOrder.description} disabled={isReadOnly} onChange={e => handleChange("description", e.target.value)} />

          <Label htmlFor="priority">Priority</Label>
          <Input id="priority" value={workOrder.priority} disabled readOnly />

          <Label htmlFor="status">Status</Label>
          <Select
            id="status"
            value={workOrder.status}
            disabled={isReadOnly}
            onChange={(e) => updateField("status", e.target.value)}
          >
            <option value="Open">Open</option>
            <option value="In_Progress">In Progress</option>
            <option value="On_Hold">On Hold</option>
            <option value="Closed">Closed</option>
            <option value="Cancelled">Cancelled</option>
          </Select>

        </div>
      </FormCard>

      {/* 🏷 Asset Info */}
      <FormCard title="Assigned Asset">
        <div className="space-y-2">
          <Label htmlFor="assetTag">Tag #</Label>
          <Input id="assetTag" value={workOrder.assetId.ctrlNumber || workOrder.assetId.ctrlNumber} disabled readOnly />

          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input id="manufacturer" value={workOrder.assetId.manufacturer || ""} disabled readOnly />

          <Label htmlFor="model">Model</Label>
          <Input id="model" value={workOrder.assetId.model || ""} disabled readOnly />

          <Label htmlFor="serialNumber">Serial#</Label>
          <Input id="serialNumber" value={workOrder.assetId.serialNumber || ""} disabled readOnly />

        </div>
      </FormCard>

    </div>
  );
};

export default WorkOrderFormFields;