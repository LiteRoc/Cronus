import React from "react";
import { WorkOrder } from "../../../types/types";

interface Props {
  workOrder: WorkOrder;
  onAddTimeLog?: () => void;
  onEditTimeLog?: (timeLogId: string, updates: Partial<{ timeSpent: number; description: string }>) => void;
  onEditTravelLog?: (travelLogId: string, updates: Partial<{ travelTime: number }>) => void;
  onDeleteTimeLog?: (timeLogId: string) => void;
  onDeleteTravelLog?: (travelLogId: string) => void;
}

const TimeAndTravelLogs: React.FC<Props> = ({ workOrder, onEditTimeLog, onDeleteTimeLog, onEditTravelLog, onDeleteTravelLog }) => {
  return (
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
                <th className="border p-2">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {workOrder.timeLogs.map((log, index) => (
                <tr key={index}>
                  <td className="border p-2">{log.userId?.username}</td>
                  <td className="border p-2">
                    <input
                      type="number"
                      value={log.timeSpent}
                      onChange={(e) =>
                        onEditTimeLog?.(log._id, { timeSpent: Number(e.target.value) })
                      }
                      className="border rounded px-2 py-1 w-full"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="text"
                      value={log.description}
                      onChange={(e) =>
                        onEditTimeLog?.(log._id, { description: e.target.value })
                      }
                      className="border rounded px-2 py-1 w-full"
                    />
                  </td>
                  <td className="border p-2">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A"}
                  </td>
                  <td className="border p-2">
                    <button
                      onClick={() => onDeleteTimeLog?.(log._id)}
                      className="text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                  {/*<td className="border p-2">{log.timeSpent}</td>*/}
                  {/*<td className="border p-2">{log.description || "—"}</td>*/}
                  {/*<td className="border p-2">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A"}
                  </td>*/}
                </tr>
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
                        onEditTravelLog?.(log._id, { travelTime: Number(e.target.value) })
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
                      onClick={() => onDeleteTravelLog?.(log._id)}
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
  );
};

export default TimeAndTravelLogs;