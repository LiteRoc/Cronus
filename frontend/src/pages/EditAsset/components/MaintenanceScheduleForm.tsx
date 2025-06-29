import React from "react";
import { Asset } from "../../../types/types";

interface Props {
  schedule: Asset["maintenanceSchedule"];
  onChange: (field: string, value: any) => void;
}

const MaintenanceScheduleForm: React.FC<Props> = ({ schedule, onChange }) => {
  if (!schedule) return <div>No maintenance schedule configured.</div>;

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="text-lg font-semibold mb-2">Maintenance Schedule</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-semibold">Frequency</label>
          <select
            className="w-full border p-2"
            value={schedule.frequency}
            onChange={(e) => onChange("maintenanceSchedule.frequency", e.target.value)}
          >
            <option value="Yearly">Yearly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Monthly">Monthly</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold">Next Maintenance Date</label>
          <input
            type="date"
            className="w-full border p-2"
            value={schedule.nextMaintenance?.slice(0, 10) || ""}
            onChange={(e) => onChange("maintenanceSchedule.nextMaintenance", e.target.value)}
          />
        </div>

        <div>
          <label className="block font-semibold">Last Maintenance Date</label>
          <input
            type="date"
            className="w-full border p-2"
            value={schedule.lastMaintenance?.slice(0, 10) || ""}
            onChange={(e) => onChange("maintenanceSchedule.lastMaintenance", e.target.value)}
          />
        </div>

        <div>
          <label className="block font-semibold">Procedure ID</label>
          <input
            className="w-full border p-2"
            value={typeof schedule.procedure === "string" ? schedule.procedure : schedule.procedure?._id || ""}
            onChange={(e) => onChange("maintenanceSchedule.procedure", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default MaintenanceScheduleForm;