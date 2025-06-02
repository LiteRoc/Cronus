import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAssetById, updateAsset, getProcedures } from "../../services/api";
import { Asset, Procedure, MaintenanceSchedule} from "../../types/types";
import CreateWorkOrderModal from "../Dashboard/modals/CreateWorkOrderModal";
import { handleCreateWorkOrder } from "../../utils/WorkOrderUtils";

const EditAssetPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selectedProcedureId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const fetchAsset = async () => {
      if (!id) return;
      try {
        const fetchedAsset = await getAssetById(id);
        setAsset(fetchedAsset);
      } catch (err) {
        console.error("Failed to fetch asset:", err);
      }
    };

    const fetchProcedures = async () => {
      try {
        const fetchedProcedures = await getProcedures();
        setProcedures(fetchedProcedures);
      } catch (err) {
        console.error("Failed to fetch procedures:", err);
      }
    };

    fetchAsset();
    fetchProcedures();
  }, [id]);

  const handleCloseCreateModal = () => { setShowCreateModal(false) };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setAsset((prev) =>
      prev
      ? {
          ...prev,
          maintenanceSchedule: {
            ...prev.maintenanceSchedule,
            ...(name in (prev.maintenanceSchedule || {}) ? { [name]: value } : {}),
          } as MaintenanceSchedule, // Ensure type safety
          ...(name in prev ? { [name]: value } : {}), // Only update if key exists in Asset
        }
      : prev
    );
  };

  const handleProcedureChange = (procedureId: string) => {
    const selectedProcedure = procedures.find((proc) => proc._id === procedureId);
    setAsset((prev) =>
      prev
      ? {
          ...prev,
          maintenanceSchedule: {
            ...prev.maintenanceSchedule,
            procedure: selectedProcedure || undefined,
          } as MaintenanceSchedule, // Explicitly cast to the correct type
        }
      : prev
    );
  }; 

  const handleSave = async () => {
    try {
      if (asset) {
        const updatedAsset = {
          ...asset,
          maintenanceSchedule: {
            ...asset.maintenanceSchedule,
            procedures: asset.maintenanceSchedule?.procedure?._id || undefined,
            frequency: asset.maintenanceSchedule?.frequency || "Yearly", // Ensure frequency is always valid
          },
        };
        await updateAsset(id!, updatedAsset);
        alert("Asset updated successfully!");
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Failed to update asset:", err);
      alert("Failed to update asset. Please try again.");
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Edit Asset</h1>
      {asset ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4"
        >
          <div className="form-group">
            <label htmlFor="ctrlNumber">Control Number</label>
            <input
              id="ctrlNumber"
              name="ctrlNumber"
              type="text"
              value={asset.ctrlNumber}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
            />
          </div>
          <div className="form-group">
              <label htmlFor="manufacturer">Manufacturer</label>
              <input
                id="manufacturer"
                name="manufacturer"
                type="text"
                value={asset.manufacturer}
                onChange={handleInputChange}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="form-group">
              <label htmlFor="model">Model</label>
              <input
                id="model"
                name="model"
                type="text"
                value={asset.model}
                onChange={handleInputChange}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="form-group">
              <label htmlFor="serialNumber">Serial#</label>
              <input
                id="serailNumber"
                name="serialNumber"
                type="text"
                value={asset.serialNumber}
                onChange={handleInputChange}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                value={asset.category}
                onChange={handleInputChange}
                className="border p-2 rounded w-full"
              >
                <option value="Biomed">Biomed</option>
                <option value="Test Equipment">Test Equipment</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={asset.status}
                onChange={handleInputChange}
                className="border p-2 rounded w-full"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={asset.notes || ""}
                onChange={handleInputChange}
                className="border p-2 rounded w-full"
                rows={4}
              ></textarea>
            </div>

          {/* Maintenance Schedule */}
          <h2 className="text-xl font-semibold mt-6 border-t pt-4">Maintenance Schedule</h2>
          <div className="form-group">
            <label htmlFor="frequency">Frequency</label>
            <select
              id="frequency"
              name="frequency"
              value={asset.maintenanceSchedule?.frequency || "Yearly"}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
            >
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Yearly">Yearly</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="lastMaintenance">Last Maintenance</label>
            <input
              id="lastMaintenance"
              name="lastMaintenance"
              type="date"
              value={asset.maintenanceSchedule?.lastMaintenance?.split("T")[0] || ""}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
            />
          </div>

          <div className="form-group">
            <label htmlFor="nextMaintenance">Next Maintenance</label>
            <input
              id="nextMaintenance"
              name="nextMaintenance"
              type="date"
              value={asset.maintenanceSchedule?.nextMaintenance?.split("T")[0] || ""}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
            />
          </div>

          <div className="form-group">
            <label htmlFor="procedure">Procedure</label>
            <div className="flex items-center space-x-4">
              <input
                id="procedure"
                name="procedure"
                type="text"
                value={asset.maintenanceSchedule?.procedure?.name || "No procedure attached"}
                readOnly
                className="border p-2 rounded w-full bg-gray-200"
              />
              <select
                value={selectedProcedureId || ""}
                onChange={(e) => handleProcedureChange(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="">Select Procedure</option>
                {procedures.map((procedure) => (
                  <option key={procedure._id} value={procedure._id}>
                    {procedure.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleProcedureChange("")}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          </div>
          
          {/* Work Orders */}
          <h2 className="text-xl font-semibold mt-6 border-t pt-4">Work Orders</h2>
          {asset.workOrders && asset.workOrders.length > 0 ? (
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
                {asset.workOrders.map((workOrder, index) => (
                  <tr key={workOrder._id || index}>
                    <td className="border border-gray-300 p-2">{workOrder.description}</td>
                    <td className="border border-gray-300 p-2">{workOrder.status}</td>
                    <td className="border border-gray-300 p-2">
                      {new Date(workOrder.scheduledDate).toLocaleDateString()}
                    </td>
                    <td className="border border-gray-300 p-2">
                      {workOrder.completionDate
                        ? new Date(workOrder.completionDate).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="border border-gray-300 p-2">
                      <button
                        type="button" // Change to "button" to prevent form submission
                        className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                        onClick={() => navigate(`/workorders/edit/${workOrder._id}`)}
                      >
                        View Work Order
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No work orders associated with this asset.</p>
          )}
          <button
              type="button"
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              onClick={() => {
                console.log('Create Work Order button clicked');
                setShowCreateModal(true)
              }}
            >
              Create Work Order
            </button>

          {showCreateModal && asset && (
            <CreateWorkOrderModal
              asset={asset}
              onClose={handleCloseCreateModal}
              onCreate={(newWorkOrder) => 
                handleCreateWorkOrder(
                  newWorkOrder,
                  (createdWorkOrder) => {
                    console.log('Created Work Order:', createdWorkOrder);
                    setShowCreateModal(false);
                  },
                  (error) => {
                    console.error('Error creating work order:', error);
                    alert('Failed to create work order. Please try again.')
                  }
                )
              }
            />
          )}

          <div className="flex space-x-4 mt-4 border-t pt-4">
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p>Loading asset...</p>
      )}
    </div>
  );
};

export default EditAssetPage;