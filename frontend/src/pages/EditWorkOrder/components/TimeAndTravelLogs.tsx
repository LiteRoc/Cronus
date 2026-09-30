//src/pages/EditWorkOrder/components/TimeAndTravelLogs.tsx

import React, { useEffect, useState } from "react";
import { WorkOrder, TimeLog, TimeLogCorrection } from "@/types";
import { showError } from "@/utils/toastUtils";
import { FormCard } from "@/components/ui";

interface Props {
  workOrder: WorkOrder;
  userId: string;
  onEditTimeLog?: (workOrderId: string, logId: string, updates: TimeLogCorrection) => Promise<unknown>;
  onEditTravelLog?: (workOrderId: string, logId: string, updates: Partial<{ travelTime: number; note?: string }>) => void;

  onDeleteTimeLog?: (workOrderId: string, logId: string) => void;
  onDeleteTravelLog?: (workOrderId: string, logId: string) => void;
}

const TimeAndTravelLogs: React.FC<Props> = ({ workOrder, onEditTimeLog, onDeleteTimeLog, onEditTravelLog, onDeleteTravelLog }) => {
  return (
    <FormCard title="Time & Travel Logs">
      <div className="space-y-6 mt-8">
        {/* Time Logs */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Time Logs</h2>
          {workOrder.timeLogs && workOrder.timeLogs.length > 0 ? (
            <table className="w-full border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2">User</th>
                  <th className="border p-2">Time Spent (min)</th>
                  <th className="border p-2">Description</th>
                  <th className="border p-2">Work date</th>
                  <th className="border p-2">Timestamp</th>
                  <th className="border p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.timeLogs.map(log => (
                  <LaborRow key={log._id} log={log} workOrderId={workOrder._id}
                    onEdit={onEditTimeLog} onDelete={onDeleteTimeLog} />
                ))}
              </tbody>
            </table>
          ) : (
            <p>No time logs recorded.</p>
          )}
        </div>

        {/* Travel Logs */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Travel Logs</h2>
          {workOrder.travelLogs && workOrder.travelLogs.length > 0 ? (
            <table className="w-full border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2">User</th>
                  <th className="border p-2">Travel Time (min)</th>
                  <th className="border p-2">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.travelLogs.map((log, index) => (
                  <tr key={index}>
                    <td className="border p-2">{log.userId?.username}</td>
                    <td className="border p-2">
                      <input
                        type="number"
                        value={log.travelTime}
                        onChange={(e) =>
                          onEditTravelLog?.(workOrder._id, log._id, { travelTime: Number(e.target.value) })
                        }
                        className="border rounded px-2 py-1 w-full"
                      />
                    </td>
                    {/* <td className="border p-2">{log.travelTime}</td> */}
                    <td className="border p-2">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A"}
                    </td>
                    <td className="border p-2">
                      <button
                        onClick={() => onDeleteTravelLog?.(workOrder._id, log._id)}
                        className="text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No travel logs recorded.</p>
          )}
        </div>
      </div>
    </FormCard>
  );
};

function LaborRow({ log, workOrderId, onEdit, onDelete }: {
  log: TimeLog; workOrderId: string;
  onEdit: Props['onEditTimeLog']; onDelete: Props['onDeleteTimeLog'];
}) {
  const [minutes, setMinutes] = useState(String(log.timeSpent));
  const [description, setDescription] = useState(log.description || '');
  const [workDate, setWorkDate] = useState(log.workDate || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setMinutes(String(log.timeSpent)); setDescription(log.description || ''); setWorkDate(log.workDate || '');
  }, [log.timeSpent, log.description, log.workDate]);
  const save = async () => {
    const updates: TimeLogCorrection = {};
    if (Number(minutes) !== log.timeSpent) updates.timeSpent = Number(minutes);
    if (description !== (log.description || '')) updates.description = description;
    if (workDate !== (log.workDate || '')) updates.workDate = workDate;
    if (!Object.keys(updates).length || !onEdit) return;
    setSaving(true);
    try { await onEdit(workOrderId, log._id, updates); }
    catch { showError('Labor correction failed. Refresh the Work Order before retrying.'); }
    finally { setSaving(false); }
  };
  return <tr>
    <td className="border p-2">{log.userId?.username}</td>
    <td className="border p-2"><input aria-label="Labor minutes" type="number" min="1" value={minutes}
      disabled={saving} onChange={e => setMinutes(e.target.value)} className="border rounded px-2 py-1 w-full" /></td>
    <td className="border p-2"><input aria-label="Labor description" value={description}
      disabled={saving} onChange={e => setDescription(e.target.value)} className="border rounded px-2 py-1 w-full" /></td>
    <td className="border p-2"><input aria-label="Labor work date" type="date" value={workDate}
      disabled={saving} onChange={e => setWorkDate(e.target.value)} className="border rounded px-2 py-1 w-full" /></td>
    <td className="border p-2">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</td>
    <td className="border p-2">
      <button type="button" disabled={saving || !onEdit || !Number.isFinite(Number(minutes)) || Number(minutes) < 1 || Boolean(log.workDate && !workDate)}
        onClick={save} className="text-blue-500 hover:underline mr-2">{saving ? 'Saving…' : 'Save'}</button>
      <button type="button" disabled={saving} onClick={() => onDelete?.(workOrderId, log._id)} className="text-red-500 hover:underline">Delete</button>
    </td>
  </tr>;
}

export default TimeAndTravelLogs;
