import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkOrder } from "@/types";
import { formatDate } from "@/utils/DashboardUtils";

interface WorkOrderTableProps {
    workOrders: WorkOrder[];
}

type SortKey = keyof Pick<WorkOrder, "workOrderNumber" | "description" | "createdAt" | "status" | "workOrderType">;

const WorkOrderTable: React.FC<WorkOrderTableProps> = ({ workOrders }) => {
    const navigate = useNavigate();
    const [sortKey, setSortKey] = useState<SortKey>("workOrderNumber");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
        // toggle direction if clicking same column
        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
        setSortKey(key);
        setSortDirection("asc");
        }
    };

    const renderSortIndicator = (key: SortKey) => {
      if (sortKey !== key) return null;
      return sortDirection === "asc" ? " ▲" : " ▼";
    };

    const sortedWorkOrders = [...workOrders].sort((a, b) => {
        const aVal = (a[sortKey] ?? "").toString().toLowerCase();
        const bVal = (b[sortKey] ?? "").toString().toLowerCase();

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
    });

    const renderStatusChip = (status?: string) => {
        if (!status) return null;
        const colorMap: Record<string, string> = {
            Open: "bg-green-100 text-green-800",
            In_Progress: "bg-gray-100 text-gray-800",
            On_Hold: "bg-yellow-100 text-yellow-800",
            Closed: "bg-blue-100 text-blue-800",
            Cancelled: "bg-red-100 text-red-800",
        };
        return (
            <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                colorMap[status] || "bg-gray-200 text-gray-700"
                }`}
            >
                {status}
            </span>
        );
    };

    return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
    <table className="w-full table-auto border-collapse border border-gray-300">
      <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10">
        <tr>
          <th
            className="border px-4 py-2 cursor-pointer"
            onClick={() => handleSort("workOrderNumber")}
          >
            Control #{renderSortIndicator("workOrderNumber")}
          </th>
          <th
            className="border px-4 py-2 cursor-pointer"
            onClick={() => handleSort("description")}
          >
            Model{renderSortIndicator("description")}
          </th>
          <th
            className="border px-4 py-2 cursor-pointer"
            onClick={() => handleSort("createdAt")}
          >
            Manufacturer{renderSortIndicator("createdAt")}
          </th>
          <th
            className="border px-4 py-2 cursor-pointer"
            onClick={() => handleSort("status")}
          >
            Status{renderSortIndicator("status")}
          </th>
          <th
            className="border px-4 py-2 cursor-pointer"
            onClick={() => handleSort("workOrderType")}
          >
            Serial #{renderSortIndicator("workOrderType")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {sortedWorkOrders.map((workOrder) => (
          <tr
            key={workOrder._id}
            className="hover:bg-gray-50 cursor-pointer "
            onClick={() => navigate(`/workorders/edit/${workOrder._id}`)}
          >
            <td className="px-3 py-2 font-medium">{workOrder.workOrderNumber}</td>
            <td className="px-3 py-2 truncate max-w-[150px]">{formatDate(workOrder.createdAt)}</td>
            <td className="border px-4 py-2">{renderStatusChip(workOrder.status)}</td>
            <td className="border px-4 py-2">{workOrder.workOrderType}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
};

export default WorkOrderTable;