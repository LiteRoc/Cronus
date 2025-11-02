// src/components/MaintenanceScheduleForm.tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/DatePicker";
import { ProcedureSelector } from "@/components/procedures/ProcedureSelector";
import { FormCard } from "@/components/ui/formCard";
import { Select } from "@/components/ui/select";
import { Asset } from "@/types/Asset"

type Props = {
  asset: Asset;
  updateField: (path: string, value: any) => void;
  isReadOnly?: boolean;
};

export const MaintenanceScheduleForm: React.FC<Props> = ({
  asset,
  updateField,
  isReadOnly = false,
}) => {
  const schedule = asset.maintenanceSchedule || {};

  return (
    <FormCard title="Maintenance Schedule">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Frequency</Label>
          <Select
            disabled={isReadOnly}
            value={schedule.frequency ?? ""}
            onChange={(val) => updateField("maintenanceSchedule.frequency", val)}
          >
            <option value="">Select frequency</option>
            <option value="Yearly">Yearly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Monthly">Monthly</option>
            <option value="Custom">Custom</option>
          </Select>
        </div>

        <div>
          <Label>Interval (months)</Label>
          <Input
            type="number"
            disabled={isReadOnly}
            value={schedule.intervalMonths ?? ""}
            onChange={(e) =>
              updateField("maintenanceSchedule.intervalMonths", parseInt(e.target.value, 10) || undefined)
            }
            placeholder="e.g. 12"
          />
        </div>

        <div>
          <Label>Last Maintenance</Label>
          <DatePicker
            disabled={isReadOnly}
            value={schedule.lastMaintenance ? new Date(schedule.lastMaintenance) : null}
            onChange={(date) => updateField("maintenanceSchedule.lastMaintenance", date)}
          />
        </div>

        <div>
          <Label>Next Maintenance</Label>
          <DatePicker
            disabled={isReadOnly}
            value={schedule.nextMaintenance ? new Date(schedule.nextMaintenance) : null}
            onChange={(date) => updateField("maintenanceSchedule.nextMaintenance", date)}
          />
        </div>

        <div className="md:col-span-2">
          <Label>Procedure</Label>
          <ProcedureSelector
            disabled={isReadOnly}
            selectedId={schedule.procedure ?? ""}
            onChange={(id) => updateField("maintenanceSchedule.procedure", id)}
          />
        </div>
      </div>
    </FormCard>
  );
};

export default MaintenanceScheduleForm;