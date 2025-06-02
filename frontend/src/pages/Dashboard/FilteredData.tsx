import React from "react";
import { Asset, WorkOrder, Part } from "../../types/types";
import { isWorkOrder, isAsset, isPart } from "../../utils/typeGuards";

interface FilteredDataProps {
  type: "workOrders" | "assets" | "parts";
  items: (WorkOrder | Asset | Part)[];
  onEdit: (item: WorkOrder | Asset | Part) => void;
  onDelete: (id: string) => void;
  onCreateWorkOrder?: (asset: Asset) => void; // Optional for asset only
}

const FilteredData: React.FC<FilteredDataProps> = ({
  type,
  items,
  onEdit,
  onDelete,
  onCreateWorkOrder,
}) => {
  if (!items.length) {
    return (
      <div className="text-center mt-4 text-gray-500">
        No {type === "workOrders" ? "Work Orders" : type === "assets" ? "Assets" : "Parts"} found.
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item._id} className="bg-white shadow-md rounded p-4">
            {isWorkOrder(item) && (
              <>
                <p><strong>Work Order Number:</strong> {item.workOrderNumber}</p>
                <p><strong>Status:</strong> {item.status}</p>
                <p><strong>Description:</strong> {item.description}</p>
                <p><strong>Assigned To:</strong> {item.assignedTo?.username || 'Unassigned'}</p>
              </>
            )}

            {isAsset(item) && (
              <>
                <p><strong>Asset ID:</strong> {item._id}</p>
                <p><strong>Control Number:</strong> {item.ctrlNumber}</p>
                <p><strong>Manufacturer:</strong> {item.manufacturer}</p>
                <p><strong>Model:</strong> {item.model}</p>
              </>
            )}

            {isPart(item) && (
              <>
                <p><strong>Part Number:</strong> {item.partNumber}</p>
                <p><strong>Description:</strong> {item.description}</p>
                <p><strong>Price:</strong> ${item.quantityOnHand.toFixed(2)}</p>
                <p><strong>Availability:</strong> {item.quantityOnHand > 0 ? "In Stock" : "Out of Stock"}</p>
              </>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex space-x-2">
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded"
                onClick={ () => {
                  console.log('Edit button clicked for item:', item);
                  onEdit(item);
                }}
              >
                Edit
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={() => onDelete(item._id)}
              >
                Delete
              </button>
              {type === "assets" && isAsset(item) && onCreateWorkOrder && (
                <button
                  className="bg-green-500 text-white px-4 py-2 rounded"
                  onClick={() => onCreateWorkOrder(item)}
                >
                  Create Work Order
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilteredData;
