import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkOrderForm } from "../../hooks/workorders/useWorkOrderForm";
import { useWorkOrderLogs } from "../../hooks/workorders/useWorkOrderLogs";
import { useUser } from "../../context/UserContext";
import WorkOrderFormFields from "./components/WorkOrderFormFields";
import PartsUsedSection from "./components/PartsUsedSection";
import TimeAndTravelLogs from "./components/TimeAndTravelLogs";
import ProcedureTaskResults from "./components/ProcedureTaskResults";
import TestEquipmentSection from "./components/TestEquipmentSection";
import { formatDate } from "../../utils/DashboardUtils";
import AddTimeLogModal from "./modals/AddTimeLogModal";
import AddPartModal from "./modals/AddPartModal";
import { calculateTimeTotals, calculateTravelTotals } from "../../utils/logHelpers";
import { useWorkOrderParts } from "../../hooks/workorders/useWorkOrderParts";
import { useWorkOrderProcedure } from "../../hooks/workorders/useWorkOrderProcedure";
import AddProcedureModal from "./modals/AddProcedureModal";
import AddTestEquipmentModal from "./modals/AddTestEquipmentModal";
import { useTestEquipment } from "../../hooks/workorders/useTestEquipment";

const EditWorkOrderPage: React.FC = () => {
  const { id: workOrderId } = useParams();
  const { user } = useUser();

  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [isProcedureModalOpen, setIsProcedureModalOpen] = useState(false);
  const [isTestEquipModalOpen, setIsTestEquipModalOpen] = useState(false);

  const navigate = useNavigate();

  const {
    workOrder,
    isLoading,
    isSaving,
    error,
    handleChange,
    save,
    fetchWorkOrder
  } = useWorkOrderForm(workOrderId || "");

  useEffect(() => {
    fetchWorkOrder();
  }, [workOrderId]);

  const timeSummary = calculateTimeTotals(workOrder?.timeLogs || []);
  const travelSummary = calculateTravelTotals(workOrder?.travelLogs || []);


  const { addLog, editTimeLog, editTravelLog, removeTimeLog, removeTravelLog } = useWorkOrderLogs(workOrderId || "", user?.id || "", fetchWorkOrder);
  const { addPart, editPart, removePart } = useWorkOrderParts(workOrderId || "", fetchWorkOrder)
  const { assignProcedure, removeProcedure, updateTaskResults } = useWorkOrderProcedure(workOrderId || "", fetchWorkOrder);
  const { addEquip } = useTestEquipment(workOrderId || "", fetchWorkOrder);

  if (isLoading) return <div>Loading work order...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!workOrder) return <div>Work order not found.</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Work Order</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const success = await save();
          if (success) {
            navigate("/workorders");
          }
        }}
        className="space-y-4"
      >
        {/* Work Order Fields */}
        <WorkOrderFormFields
          workOrder={workOrder}
          onChange={handleChange}
        />
        {/* Display the close date*/}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Completion Date</label>
          <p className="mt-1 text-gray-900">
            {formatDate(workOrder.completionDate)}
          </p>
        </div>

        {/* Time & Travel Logs */}
        <TimeAndTravelLogs
          workOrder={workOrder}
          onEditTimeLog={editTimeLog}
          onEditTravelLog={editTravelLog}
          onDeleteTimeLog={removeTimeLog}
          onDeleteTravelLog={removeTravelLog}
          />
        {/* Add Time Button */}
        <button
          onClick={() => setIsTimeLogModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          + Add Time Log
        </button>
        {isTimeLogModalOpen && (
          <AddTimeLogModal
            onSave={addLog}
            onClose={() => setIsTimeLogModalOpen(false)}
          />
        )}
        {/* Time Summary */}
        <section className="bg-gray-50 border rounded p-4 my-4">
          <h3 className="font-semibold mb-2 text-lg">Work Log Summary</h3>
          <ul className="text-sm space-y-1">
            <li><strong>Time Logs:</strong> {timeSummary.entryCount} entries, {timeSummary.totalMinutes} minutes total</li>
            <li><strong>Travel Logs:</strong> {travelSummary.entryCount} entries, {travelSummary.totalMinutes} minutes total</li>
            <li><strong>Combined Total:</strong> {timeSummary.totalMinutes + travelSummary.totalMinutes} minutes</li>
          </ul>
        </section>

        {/* Task Results */}
        {workOrder.procedure ? (
          <ProcedureTaskResults
            workOrder={workOrder}
            onDeleteProcedure={removeProcedure}
            onUpdateTask={updateTaskResults}
            onRefresh={fetchWorkOrder}
          />
        ) : (
          <div className="mb-4 p-4 border bg-gray-50 rounded text-gray-600 flex justify-between">
            <span>No procedure attached</span>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              onClick={() => setIsProcedureModalOpen(true)}
            >
              + Add Procedure
            </button>
          </div>
        )}
        
        {isProcedureModalOpen && (
          <AddProcedureModal
            isOpen={isProcedureModalOpen}
            onSave={assignProcedure}
            onClose={() => setIsProcedureModalOpen(false)}
            />
        )}

        {/* Parts Used */}
        {workOrder.partsUsed && (
          <PartsUsedSection 
            partsUsed={workOrder.partsUsed}
            onEditPart={editPart}
            onDeletePart={removePart}
          />
        )}
        {/* Add Part Button */}
        <button
          onClick={() => setIsPartModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + Add Part
        </button>
        {isPartModalOpen && (
          <AddPartModal
            isOpen={isPartModalOpen}
            onSave={addPart}
            onClose={() => setIsPartModalOpen(false)}
            />
        )}
        <br />
        {/* Test Equip */}
        {workOrder.testEquipmentUsed && (
          <TestEquipmentSection
            testEquipment={workOrder.testEquipmentUsed}
          />
        )}
        {/* Add Test Equipment button */}
        <button
          onClick={() => setIsTestEquipModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + Add Test Equipment
          </button>
          {isTestEquipModalOpen && (
            <AddTestEquipmentModal
              isOpen={isTestEquipModalOpen}
              onClose={() => setIsTestEquipModalOpen(false)}
              onSave={addEquip}
              />
          )}
        {/* Save and Cancel Buttons*/}
        <div className="flex space-x-4 pt-6 border-t">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {isSaving ? "Saving..." : "Save Work Order"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/workorders")}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditWorkOrderPage;