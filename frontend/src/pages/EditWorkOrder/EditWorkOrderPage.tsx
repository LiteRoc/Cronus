import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import { 
  getWorkOrderById,
  updateWorkOrder,
  getAssetById,
  addTimeLog,
  addPartToWorkOrder,
  addTestEquipToWorkOrder,
  addTravelLog,
  getProcedures,
 } from "../../services/api";
import { WorkOrder, Asset, Procedure, TaskResult } from "../../types/types"; // Import WorkOrder type
import { formatDateForInput } from "../../utils/DashboardUtils";
import { generateWorkOrderPDF } from "../../utils/pdfUtils";
import AddTimeLogModal from "./modals/AddTimeLogModal";
import AddPartModal from "./modals/AddPartModal";
import PerformProcedureModal from "./modals/PerformProcedureModal";
import AddTestEquipmentModal from "./modals/AddTestEquipmentModal";
import AddProcedureModal from "./modals/AddProcedureModal";
import WorkOrderReport from "../../components/WorkOrderReport"

const EditWorkOrderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>() as { id: string }; // Get work order ID from URL and always cast it as a string
  const navigate = useNavigate(); // For navigation after saving
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [availableProcedures, setAvailableProcedures] = useState<Procedure[]>([]);

  const { user } = useUser();

  const [editedWorkOrder, setEditedWorkOrder] = useState<WorkOrder | null>(null);
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [isProcedureModalOpen, setIsProcedureModalOpen] = useState(false);
  const [isAddProcedureModalOpen, setIsAddProcedureModalOpen] = useState(false);
  const [isTestEquipModalOpen, setIsTestEquipModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  // Fetch work order details
  useEffect(() => {
    fetchWorkOrder();
    fetchProcedures();
  }, [id]);

  const fetchWorkOrder = async () => {
    try {
      const data = await getWorkOrderById(id);
      setWorkOrder(data);
      setEditedWorkOrder(data);
      console.log('Fetched Work Order:', data);

      // Fetch asset details if assetId exists
      if (data.assetId && typeof data.assetId === "string") {
          const assetData = await getAssetById(data.assetId);
          setAsset(assetData);
        } else if (data.assetId && typeof data.assetId === "object") {
          setAsset(data.assetId); // Asset already included in workOrder
        }

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch work order:", error);
      setLoading(false);
    }
  };

  const fetchProcedures = async () => {
    try {
      const data = await getProcedures(); // Replace with your API endpoint
      setAvailableProcedures(data);
    } catch (error) {
      console.error("Failed to fetch procedures:", error);
    }
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedWorkOrder((prev) => prev && { ...prev, [name]: value });
  };

  // Time Logs Handlers
  const handleAddTimeLog = async (timeLog: { timeSpent: number; description: string }, travelLog?: { travelTime: number }) => {
    try {
      if (!workOrder || !user || !user.id) {
        console.error('WorkOrder or user is null');
        console.log("User Context:", user);
        navigate('/signin');
        return;
      }
      console.log("User Context:", user);
      const userId = user.id.toString();

      // Save time log
      const timeLogPayload = {
        ...timeLog,
        userId,
      };
      await addTimeLog(workOrder._id, timeLogPayload);
  
      // Save travel log if provided
      if (travelLog) {
        const travelLogPayload = {
          ...travelLog,
          userId,
        };
        await addTravelLog(workOrder._id, travelLogPayload);
      }
  
      // Refresh work order data after adding logs
      fetchWorkOrder();
  
      alert("Time log and travel time added successfully!");
    } catch (error) {
      console.error("Failed to add time or travel log:", error);
      alert("Error adding logs. Please try again.");
    }
  };

  const handleEditTimeLog = (index: number, field: string, value: string | number) => {
    setEditedWorkOrder((prev) => {
      const updatedLogs = [...(prev?.timeLogs || [])];
      updatedLogs[index] = { ...updatedLogs[index], [field]: value };
      return prev && { ...prev, timeLogs: updatedLogs };
    });
  };

  const handleDeleteTimeLog = (index: number) => {
    setEditedWorkOrder((prev) => {
      const updatedLogs = [...(prev?.timeLogs || [])];
      updatedLogs.splice(index, 1);
      return prev && { ...prev, timeLogs: updatedLogs };
    });
  };

  // Parts Used Handlers
  const handleAddPart = async (partId: string, quantity: number) => {
    if (!workOrder) return;

    try {
      await addPartToWorkOrder(workOrder._id, partId, quantity);
      fetchWorkOrder(); // Refresh work order data
      setIsPartModalOpen(false); // Close modal
    } catch (error) {
      console.error("Failed to add part:", error);
    }
  };

  // Remove Part Handler
  const handleRemovePart = async (index: number) => {
    setEditedWorkOrder((prev) => {
      const updatedParts = [...(prev?.partsUsed || [])];
      updatedParts.splice(index, 1);
      return prev && { ... prev, partsUsed: updatedParts };
    })
  };

  const handleSaveProcedure = async (procedureId: string) => {
    if (!workOrder) return;
    try {
      const updatedWorkOrder = {
        ...workOrder,
        procedure: availableProcedures.find((p) => p._id === procedureId) || undefined,
      };
  
      await updateWorkOrder(id, updatedWorkOrder); // Call API to save changes
      setWorkOrder(updatedWorkOrder); // Update local state
      setEditedWorkOrder(updatedWorkOrder);
      alert("Procedure updated successfully!");
    } catch (error) {
      console.error("Error saving procedure:", error);
      alert("Failed to update the procedure. Please try again.");
    }
  };  
  const handleSaveProcedureResults = async (updatedResults: TaskResult[]) => {
    try {
      if (workOrder) {
        // Store results in the work order, not the procedure
        const updatedWorkOrder = {
          ...workOrder,
          taskResults: updatedResults, // Store task results at work order level
        };
  
        await updateWorkOrder(id, updatedWorkOrder); // Update work order with results
  
        setWorkOrder(updatedWorkOrder); // Update state
        setEditedWorkOrder(updatedWorkOrder);
  
        alert("Task results saved successfully!");
      }
    } catch (error) {
      console.error("Error saving procedure results:", error);
      alert("Failed to save task results. Please try again.");
    }
  };
  
  // Test Equip Handlers
  const handleAddTestEquip = async (testEquipmentId: string) => {
    if (!workOrder) return

    try {
      await addTestEquipToWorkOrder(id, testEquipmentId);
      fetchWorkOrder(); // Refresh work order data
      setIsTestEquipModalOpen(false); // Close modal
    } catch (error) {
      console.error('Failed to add test-equipment');
    }
  }
  
  // Handle Save
  const handleSave = async () => {
    if (!editedWorkOrder) return;
    try {
      await updateWorkOrder(id, editedWorkOrder);
      alert("Work order updated successfully!");
      navigate(-1); // Go back to the previous page
    } catch (error) {
      console.error("Failed to update work order:", error);
      alert("Failed to update work order.");
    }
  };

  const handleDownloadWorkOrderPDF = () => {
    if (!workOrder) {
      alert('Work order data is missing.');
      return;
    } 

    generateWorkOrderPDF(workOrder, asset);
  }

  if (loading) return <div>Loading...</div>;
  if (!workOrder) return <div>Work order not found</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Edit Work Order</h1>
        {/* Render WorkOrderReport in a hidden container */}
        <div style={{ position: "absolute", top: "-9999px", left: "-9999px" }}>
          {workOrder && <WorkOrderReport workOrder={workOrder} />}
        </div>
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          onClick={handleDownloadWorkOrderPDF}
        >
          Download Work Order Report as PDF
        </button>
      <div className="mt-4 flex justify-end">
      </div>
      <br></br>
      {/* Work Order Details Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group">
          <label className="block font-medium mb-1">Work Order Number</label>
          <input
            type="text"
            name="workOrderNumber"
            value={editedWorkOrder?.workOrderNumber || ""}
            className="border p-2 rounded w-full bg-gray-200"
            readOnly
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="form-group">
              <label className="block font-medium mb-1">Scheduled Date</label>
              <input
                type="date"
                name="scheduledDate"
                value={formatDateForInput(editedWorkOrder?.scheduledDate || "")}
                className="border p-2 rounded w-full"
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
                <label htmlFor="dueDate">Due Date</label>
                <input
                  id="dueDate"
                  name="dueDate"
                  type="text"
                  value={editedWorkOrder?.dueDate.split("T")[0]}
                  readOnly
                  className="border p-2 rounded w-full bg-gray-200"
                />
              </div>
            </div>
        </div>

        <div className="form-group col-span-2">
          <label className="block font-medium mb-1">Description</label>
          <textarea
            name="description"
            value={editedWorkOrder?.description || ""}
            className="border p-2 rounded w-full"
            rows={3}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div className="form-group">
          <label className="block font-medium mb-1">Status</label>
          <select
            name="status"
            value={editedWorkOrder?.status || ""}
            className="border p-2 rounded w-full"
            onChange={handleInputChange}
          >
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        {editedWorkOrder?.completionDate && (
          <div className="form-group">
            <label className="block font-medium mb-1">Completion Date</label>
            <input
              type="date"
              name="completionDate"
              value={
                new Date(editedWorkOrder.completionDate)
                  .toISOString()
                  .split("T")[0]
              }
              className="border p-2 rounded w-full"
              readOnly
            />
          </div>
        )}

      {/* Asset Information */}
      {asset && (
        <div className="border-t pt-4 mt-4">
          <h2 className="text-lg font-semibold mb-2">Asset Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <p>
              <strong>Control Number:</strong> {asset.ctrlNumber}
            </p>
            <p>
              <strong>Manufacturer:</strong> {asset.manufacturer}
            </p>
            <p>
              <strong>Model:</strong> {asset.model}
            </p>
            <p>
              <strong>Status:</strong> {asset.serialNumber || "N/A"}
            </p>
          </div>
        </div>
      )}

      {/* Time Logs */}
      <section className="border-t pt-4 mt-4">
        <h3 className="font-semibold mb-2 flex justify-between">
          Time Logs
          <button 
            onClick={() => setIsTimeLogModalOpen(true)}
            className="text-blue-500 underline">
            + Add Time Log
          </button>
        </h3>
        <ul>
          {editedWorkOrder?.timeLogs?.map((log, index) => (
            <li key={index} className="mb-2">
              <input
                type="text"
                value={new Date(log.timestamp).toLocaleDateString()}
                onChange={(e) => handleEditTimeLog(index, "userId", e.target.value)}
                className="border rounded p-1 mr-2"
              />
              <input
                type="text"
                value={log.description}
                onChange={(e) => handleEditTimeLog(index, "description", e.target.value)}
                className="border rounded p-1 mr-2"
              />
              <input
                type="number"
                value={log.timeSpent}
                onChange={(e) => handleEditTimeLog(index, "timeSpent", Number(e.target.value))}
                className="border rounded p-1 mr-2"
              />
              <input
                type="text"
                value={log.userId.username}
                onChange={(e) => handleEditTimeLog(index, "username", e.target.value)}
                className="border rounded p-1 mr-2"
              />
              <button onClick={() => handleDeleteTimeLog(index)} className="text-red-500 underline">
                Delete
              </button>
            </li>
          ))}
        </ul>
      {/* Travel Logs */}
        <h3 className="font-semibold mb-2 flex justify-between">
          Travel Logs
        </h3>
        <ul>
          {editedWorkOrder?.travelLogs?.map((log, index) => (
            <li key={index} className="mb-2">
              <input
                type="text"
                value={new Date(log.timestamp).toLocaleDateString()}
                onChange={(e) => handleEditTimeLog(index, "userId", e.target.value)}
                className="border rounded p-1 mr-2"
              />
              <input
                type="number"
                value={log.travelTime}
                onChange={(e) => handleEditTimeLog(index, "travelTime", e.target.value)}
                className="border rounded p-1 mr-2"
              />
              <input
                type="text"
                value={log.userId.username}
                onChange={(e) => handleEditTimeLog(index, "username", e.target.value)}
                className="border rounded p-1 mr-2"
              />
              <button onClick={() => handleDeleteTimeLog(index)} className="text-red-500 underline">
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* AddTimeLogModal */}
      {isTimeLogModalOpen && (
        <AddTimeLogModal
          onSave={handleAddTimeLog}
          onClose={() => setIsTimeLogModalOpen(false)}
        />
        )}

      {/* Parts Used */}
      <section className="border-t pt-4 mt-4">
        <h3 className="font-semibold mb-2 flex justify-between">
          Parts Used
          <button onClick={() => setIsPartModalOpen(true)} className="text-blue-500 underline">
            + Add Part
          </button>
        </h3>
        {editedWorkOrder?.partsUsed.length ? (
    <table className="w-full border-collapse border">
      <thead>
        <tr className="bg-gray-200">
          <th className="border p-2">Part Number</th>
          <th className="border p-2">Description</th>
          <th className="border p-2">Quantity</th>
          <th className="border p-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {editedWorkOrder.partsUsed.map((item, index) => 
          item.partId ? (
          <tr key={index} className="border-t">
            <td className="border p-2">{item.partId.partNumber}</td>
            <td className="border p-2">{item.partId.description}</td>
            <td className="border p-2">{item.quantity}</td>
            <td className="border p-2">
              <button
                onClick={() => handleRemovePart(index)}
                className="text-red-500 underline"
              >
                Remove
              </button>
            </td>
          </tr>
        ) : (
          <tr key={index} className="border-t text-gray-500">
            <td colSpan={4} className="border p-2 text-center">
              Missing part details
            </td>
          </tr>
          )
        )}
      </tbody>
    </table>
  ) : (
    <p>No parts used yet.</p>
  )}
      </section>

      {/* AddPartModal */}
      <AddPartModal
        isOpen={isPartModalOpen}
        onClose={() => setIsPartModalOpen(false)}
        onSave={handleAddPart}
      />

      {/* Procedure Section */}
      <h3 className="font-semibold mb-2 flex justify-between border-t pt-4 mt-4">
        Procedure
        <button
          className="text-blue-500 underline"
          onClick={() => {
            setIsAddProcedureModalOpen((prev) => {
              console.log('isAddProcedureModalOpen toggled to:', !prev);
              return !prev;
            });
          }}
        >
          {editedWorkOrder?.procedure ? "Change Procedure" : "Add Procedure"}
        </button>
      </h3>
      {editedWorkOrder?.procedure && (
        <section>
          <p>
            <strong>Procedure Name:</strong> {editedWorkOrder.procedure.name || "Unnamed Procedure"}
          </p>
          {editedWorkOrder?.procedure && (
            <section className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-2">Tasks and Results</h3>
              {editedWorkOrder.procedure.tasks.length > 0 ? (
                <table className="w-full border-collapse border mt-2">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="border p-2">Task Description</th>
                      <th className="border p-2">Result</th>
                      <th className="border p-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedWorkOrder.procedure.tasks.map((task) => {
                      const result = editedWorkOrder.taskResults?.find(
                        (res) => res.taskId === task._id
                      );
                      return (
                        <tr key={task._id} className="border-t">
                          <td className="border p-2">{task.description}</td>
                          <td className="border p-2">
                            {result
                              ? typeof result.result === "boolean"
                                ? result.result
                                  ? "Pass"
                                  : "Fail"
                                : JSON.stringify(result.result)
                              : "No result"}
                          </td>
                          <td className="border p-2">
                            {result?.timestamp
                              ? new Date(result.timestamp).toLocaleDateString()
                              : "No timestamp"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setIsProcedureModalOpen(true)} className="text-blue-500 underline">
                      + Perfrom Procedure
                    </button>
                  </div>
                </table>
              ) : (
                <p>No tasks defined for this procedure.</p>
              )}
            </section>
            )}
        </section>
      )}

      {/* Perform Procedure Modal */}
      {isProcedureModalOpen && editedWorkOrder?.procedure && (
        <PerformProcedureModal
          isOpen={isProcedureModalOpen}
          workOrderId = { id }
          procedure={editedWorkOrder.procedure}
          onSave={handleSaveProcedureResults}
          onClose={() => setIsProcedureModalOpen(false)}
        />
      )}

      {/* Add Procedure Modal */}
      {isAddProcedureModalOpen && (
        <AddProcedureModal
          isOpen={isAddProcedureModalOpen}
          onClose={() => setIsAddProcedureModalOpen(false)}
          procedures={availableProcedures} // Replace with actual procedure data
          onSave={(procedureId) => handleSaveProcedure(procedureId)}
        />
      )}

      {/* Test Equip Section */}
      {editedWorkOrder?.testEquipmentUsed && (
        <section className="border-t pt-4 mt-4">
          <h3 className="font-semibold mb-2 flex justify-between">
          Test Equipment
          <button onClick={() => setIsTestEquipModalOpen(true)} className="text-blue-500 underline">
            + Add Test Equip
          </button>
        </h3>
          {editedWorkOrder.testEquipmentUsed && editedWorkOrder.testEquipmentUsed.length > 0 ? (
            <table className="w-full border-collapse border mt-2">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border p-2">Tag#</th>
                  <th className="border p-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {editedWorkOrder.testEquipmentUsed?.map((equipment) =>
                  typeof editedWorkOrder.testEquipmentUsed === "object" ? (
                    <tr key={equipment._id} className="border-t">
                      <td className="border p-2">{equipment.ctrlNumber}</td>
                      <td className="border p-2">{equipment.manufacturer || "No description"}</td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          ) : (
            <p>No Test Equipment defined for this procedure.</p>
          )}
        </section>
      )}

      { /* Add Test Equip Modal*/ }
      {isTestEquipModalOpen && editedWorkOrder?.testEquipmentUsed && (
        <AddTestEquipmentModal
          isOpen={isTestEquipModalOpen}
          onClose={() => setIsTestEquipModalOpen(false)}
          onAdd={handleAddTestEquip}
          />
      )}

      {/* Save Button */}
      <div className="mt-4">
        <button
          onClick={handleSave}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Save Changes
        </button>
        <button
          onClick={() => navigate(-1)}
          className="ml-2 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default EditWorkOrderPage;