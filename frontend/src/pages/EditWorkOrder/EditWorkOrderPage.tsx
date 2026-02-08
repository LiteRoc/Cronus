//src/pages/EditWorkOrder/EditWorkOrderPage.tsx

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWorkOrderForm } from "./hooks/useWorkOrderForm";
import { useWorkOrderActions } from "./hooks/useWorkOrderActions";
import WorkOrderFormFields from "./components/WorkOrderFormFields";
import { FaArrowLeft } from "react-icons/fa";
import TimeAndTravelLogs from "./components/TimeAndTravelLogs";
import { useUser } from "@/context/UserContext";
import { Button, FormCard } from "@/components/ui";
import AddTimeLogModal from "./modals/AddTimeLogModal";
import ProcedureTaskResults from "./components/ProcedureTaskResults";
import PerformProcedureModal from "./modals/PerformProcedureModal";
import AddProcedureModal from "./modals/AddProcedureModal";
import ViewTaskModal from "./modals/ViewTaskResutsModal";
import { useProcedures } from "./hooks/useProcedures";
import PartsUsedSection from "./components/PartsUsedSection";
import { useParts } from "./hooks/useParts";
import AddPartModal from "./modals/AddPartModal";
import TestEquipmentSection from "./components/TestEquipmentSection";
import AddTestEquipmentModal from "./modals/AddTestEquipmentModal";
import { useTestEquipment } from "./hooks/useTestEquipment";

const EditWorkOrderPage: React.FC = () => {
  const { id: workOrderId } = useParams<{ id: string }>();
  const { user } = useUser();
  const userId = (user as any)?._id || (user as any)?.id || "";
  const navigate = useNavigate();

  const [isAddLogModalOpen, setIsAddLogModalOpen] = useState(false);
  const [isShowPerformModalOpen, setShowPerformModalOpen] = useState(false);
  const [isShowResultsModalOpen, setShowResultsModalOpen] = useState(false);
  const [showAddProcedureModal, setShowAddProcedureModal] = useState(false);
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null);
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [showAddTestEquipModal, setShowAddTestEquipModal] = useState(false);



  const {
    workOrder,
    isLoading,
    isError,
    handleChange,
    updateField,
    mutate
  } = useWorkOrderForm(workOrderId || "");

  const {
    addTimeLog,
    updateTimeLog,
    deleteTimeLog,
    addTravelLog,
    updateTravelLog,
    deleteTravelLog,
    deleteProcedure,
    attachProcedure,
    updateTaskResults,
    addPart,
    deletePart,
    addTestEquip,
    deleteTestEquip,
    // plus others: assignProcedureToWorkOrder, addPartUsed, etc.
  } = useWorkOrderActions(mutate);

  const { procedures } = useProcedures();
  //const { procedure: selectedProcedure } = useProcedureById(selectedProcedureId);
  const selectedProcedure = workOrder?.procedures?.find(
    (p) => p._id === selectedProcedureId
  );


  const { parts } = useParts();

  const { testEquip } = useTestEquipment();

  console.log("Selected Procedure's TaskResults being retrieved:", selectedProcedure?.taskResults);

  if (!workOrderId) return <p className="p-4 text-red-500">Invalid Work Order ID</p>;
  if (isLoading) return <p className="p-4">Loading work order...</p>;
  if (isError || !workOrder) return <p className="p-4 text-red-500">Failed to load work order.</p>;

  return (
    <div className="container mx-auto px-4 py-6">
      <button className="mb-4 flex items-center text-blue-600 hover:underline" onClick={() => navigate(-1)}>
        <FaArrowLeft className="mr-2" /> Back
      </button>

      <h1 className="text-2xl font-bold mb-6">Edit Work Order</h1>

      <WorkOrderFormFields
        workOrder={workOrder}
        isReadOnly={false}
        handleChange={handleChange}
        updateField={updateField}
      />

      {/* Add Time Log Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => setIsAddLogModalOpen(true)}
          variant="default" // or "outline", "ghost", "destructive"
          size="md"         // or "sm", "lg"
          className="mt-4"
        >
          + Add Time / Travel Log
        </Button>
      </div>

      {/* Time & Travel Logs */}
      <TimeAndTravelLogs
        workOrder={workOrder}
        userId={userId}
        onEditTimeLog={updateTimeLog}
        onEditTravelLog={updateTravelLog}
        onDeleteTimeLog={deleteTimeLog}
        onDeleteTravelLog={deleteTravelLog}
      />

      {/* Add Procedure */}
      <div className="flex justify-end">
        <Button
          onClick={() => setShowAddProcedureModal(true)}
          variant="default" // or "outline", "ghost", "destructive"
          size="md"         // or "sm", "lg"
          className="mt-4"
        >
          + Add Procedure
        </Button>
      </div> 
      
      {/* Task Resutls /  Add Procedure*/}
      {workOrder.procedures && workOrder.procedures.length > 0 ? (
      <ProcedureTaskResults
        workOrder={workOrder}
        onDeleteProcedure={(procedureId: string) =>
          deleteProcedure(workOrderId, procedureId)
        }
        onShowPerformModal={(procedureId: string) => {
          setSelectedProcedureId(procedureId);
          setShowPerformModalOpen(true)}
        }
        onShowResultsModal={(procedureId: string) => {
          setSelectedProcedureId(procedureId)
          setShowResultsModalOpen(true)}
        }
      />
      ) : (
        <FormCard title="Procedure">
          <div className="mb-4 p-4 border bg-gray-50 rounded text-gray-600 flex justify-between">
            <span>No procedure attached</span>
            <button
              type="button"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              onClick={() => setShowAddProcedureModal(true)}
            >
              + Add Procedure
            </button>
          </div>
        </FormCard>
        
      )}

      {/* Add Part */}
      <div className="flex justify-end">
        <Button
          onClick={() => setShowAddPartModal(true)}
          variant="default" // or "outline", "ghost", "destructive"
          size="md"         // or "sm", "lg"
          className="mt-4"
        >
          + Add Parts
        </Button>
      </div> 

      <PartsUsedSection
        workOrder={workOrder}
        onShowAddPartModal={() => setShowAddPartModal(true)}
        onDeletePart={(partId: string) =>
          deletePart(workOrderId, partId)
        }
      />

      <TestEquipmentSection
        workOrder={workOrder}
        onShowAddTestEquipModal={() => setShowAddTestEquipModal(true)}
        onDeleteTestEquip={(equipmentId: string) => 
          deleteTestEquip(workOrderId, equipmentId)
        }
      />
      

      {isAddLogModalOpen && (
        <AddTimeLogModal
          onAddTime={async (log) => {
            await addTimeLog(workOrderId, { ...log, userId });
          }}
          onAddTravel={async (log) => {
            await addTravelLog(workOrderId, { ...log, userId, note: log.note || "" });
          }}

          onClose={() => setIsAddLogModalOpen(false)}
        />
      )}

      {showAddProcedureModal && (
        <AddProcedureModal
          procedures={procedures}
          onAttachProcedure={async (procedureId: string) => 
            await attachProcedure(workOrderId, procedureId)
          }
          onClose={() => setShowAddProcedureModal(false)}
        />
      )}

      {isShowPerformModalOpen && selectedProcedure && (
        <PerformProcedureModal
          procedure={selectedProcedure}
          onSubmitResults={async (results) => {
            if (!selectedProcedureId) return; 
            await updateTaskResults(workOrderId, selectedProcedureId, results)
          }}
          onClose={() => {
            setShowPerformModalOpen(false)
            setSelectedProcedureId(null); // clear selection when modal closes
          }}
          userId={userId}
          userName={user?.name || ""}
        />
      )}

      {isShowResultsModalOpen && selectedProcedure && (
        <ViewTaskModal
          onClose={() => {
            setShowResultsModalOpen(false)
            setSelectedProcedureId(null)
          }}
          taskResults={selectedProcedure.taskResults}
        />
      )}

      {showAddPartModal && (
        <AddPartModal
          parts={parts}
          onAttachPart={async (partId: string, quantity: number) => 
            await addPart(workOrderId, partId, quantity)
          }
          onClose={() => setShowAddPartModal(false)}
        />
      )}

      {showAddTestEquipModal && (
        <AddTestEquipmentModal
          equip={testEquip}
          onAttachEquip={async (equipId: string) =>
            await addTestEquip(workOrderId, equipId)
          }
          onClose={() => setShowAddTestEquipModal(false)}
        />
      )}
    </div>
  );
};

export default EditWorkOrderPage;
