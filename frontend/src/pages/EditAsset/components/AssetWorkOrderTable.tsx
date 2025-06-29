// src/components/assets/AssetWorkOrdersTable.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { WorkOrder } from "../../../types/types";

interface Props {
  workOrders: WorkOrder[];
}

const AssetWorkOrdersTable: React.FC<Props> = ({ workOrders }) => {
  const navigate = useNavigate();

  if (!workOrders?.length) return <p>No work orders associated with this asset.</p>;

  return (
    <table className="border-collapse border border-gray-300 w-full mt-4">
      <thead>
        <tr className="bg-gray-200">
          <th className="border border-gray-300 p-2">Description</th>
          <th className="border border-gray-300 p-2">Status</th>
          <th className="border border-gray-300 p-2">Scheduled Date</th>
          <th className="border border-gray-300 p-2">Completion Date</th>
          <th className="border border-gray-300 p-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {workOrders.map((wo) => (
          <tr key={wo._id}>
            <td className="border border-gray-300 p-2">{wo.description}</td>
            <td className="border border-gray-300 p-2">{wo.status}</td>
            <td className="border border-gray-300 p-2">
              {new Date(wo.scheduledDate).toLocaleDateString()}
            </td>
            <td className="border border-gray-300 p-2">
              {wo.completionDate
                ? new Date(wo.completionDate).toLocaleDateString()
                : "N/A"}
            </td>
            <td className="border border-gray-300 p-2">
              <button
                type="button"
                className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                onClick={() => navigate(`/workorders/edit/${wo._id}`)}
              >
                View Work Order
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AssetWorkOrdersTable;