// src/pages/EditAsset/components/AssetWorkOrderTable.tsx

import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import { useNavigate } from "react-router-dom";
import { FaPlus } from "react-icons/fa";
import { format } from "date-fns";

import { useUser } from "@/context/UserContext";
import apiClient from "@/services/apiClient";
import { FormCard } from "@/components/ui/formCard";
import CreateWorkOrderModal from "@/pages/EditAsset/modals/CreateWorkOrderModal"
import { Asset, WorkOrder, WorkOrderCreatePayload } from "@/types";
import { addWorkOrder } from "@/services";

interface WorkOrderRow {
  _id: string;
  workOrderNumber: string;
  workOrderType: string;
  status: "Open" | "In Progress" | "Completed" | "Overdue";
  assignedTo?: { name: string };
  createdAt: string;
  dueDate?: string;
}

interface WorkOrderResponse {
  workOrders: WorkOrderRow[];
}


interface Props {
  asset: Asset; // need full asset object for modal
}

const fetcher = (url: string) => apiClient.get(url).then(res => res.data);

const AssetWorkOrderTable: React.FC<Props> = ({ asset }) => {
  const { user } = useUser();
  const userId = (user as any)?._id || (user as any)?.id;
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const { data, error, isLoading } = useSWR<WorkOrderResponse>(
    asset?._id ? `/assets/${asset._id}/workorders` : null,
    fetcher
  );

  const handleCreate = async (payload: WorkOrderCreatePayload) => {
    // ensure assignedTo defaults to current user
    const finalPayload = { ...payload, assignedTo: payload.assignedTo || userId };
    await addWorkOrder(finalPayload);
  };

  const renderStatusChip = (status: WorkOrderRow["status"]) => {
    const colors: Record<string, string> = {
      "Completed": "bg-green-100 text-green-800",
      "In Progress": "bg-yellow-100 text-yellow-800",
      "Overdue": "bg-red-100 text-red-800",
      "Open": "bg-gray-100 text-gray-800",
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          colors[status] || "bg-gray-200 text-gray-700"
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <FormCard title="Work Orders">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Related Work Orders</h2>
        {(user?.role === "admin" || user?.role === "tech") && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <FaPlus className="mr-1" /> Create Work Order
          </button>
        )}
      </div>

      {isLoading && <p>Loading work orders...</p>}
      {error && <p className="text-red-500">Failed to load work orders.</p>}

      {data && data.workOrders.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left">Work Order #</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Assigned Tech</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-left">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.workOrders.map((wo) => (
                <tr
                  key={wo._id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/workorders/edit/${wo._id}`)}
                >
                  <td className="px-4 py-2 font-medium">{wo.workOrderNumber}</td>
                  <td className="px-4 py-2">{wo.workOrderType}</td>
                  <td className="px-4 py-2">{renderStatusChip(wo.status)}</td>
                  <td className="px-4 py-2">{wo.assignedTo?.name || "Unassigned"}</td>
                  <td className="px-4 py-2">
                    {wo.createdAt ? format(new Date(wo.createdAt), "MM/dd/yyyy") : "-"}
                  </td>
                  <td className="px-4 py-2">
                    {wo.dueDate ? format(new Date(wo.dueDate), "MM/dd/yyyy") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !isLoading && <p className="text-gray-500">No work orders linked to this asset.</p>
      )}

      {/* Modal for creating new work order */}
      {showModal && (
        <CreateWorkOrderModal
          asset={asset}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </FormCard>
  );
};

export default AssetWorkOrderTable;