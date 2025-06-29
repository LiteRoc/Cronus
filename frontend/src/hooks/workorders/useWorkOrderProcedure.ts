import { addProcedure, deleteProcedure } from "../../services/procedureAPI";
import { updateProcedureResults } from "../../services/workOrderAPI";
import { TaskResult } from "../../types/types";

export const useWorkOrderProcedure = (workOrderId: string, onRefresh: () => void) => {
  const assignProcedure = async (procedureId: string) => {
    try {
      await addProcedure(workOrderId, procedureId);
      onRefresh();
    } catch (err) {
      console.error("Failed to assign procedure:", err);
    }
  };

  const updateTaskResults = async (workOrderId: string, procedureId: string, taskResults: TaskResult[]) => {
    try {
      await updateProcedureResults(workOrderId, procedureId, taskResults);
      onRefresh();
    } catch (err) {
      console.error("Failed to update Results:", err);
    }
  }

  const removeProcedure = async (procedureId: string) => {
    try {
      await deleteProcedure(workOrderId, procedureId);
      onRefresh();
    } catch (err) {
      console.error("Failed to remove procedure:", err);
    }
  }

  return { assignProcedure, removeProcedure, updateTaskResults };
};