// src/hooks/workorders/useWorkOrderActions.ts

import { 
  addTimeLog, 
  addTravelLog, 
  assignProcedureToWorkOrder, 
  deleteTimeLog, 
  deleteTravelLog, 
  updateProcedureResults, 
  updateTimeLog, 
  updateTravelLog,
  removeProcedure,
  addPartToWorkOrder,
  updatePartUsed,
  deletePartFromWorkOrder,
  addTestEquipToWorkOrder,
  removeTestEquipFromWorkOrder,
} from "@/services";
import { KeyedMutator } from "swr";
import { updateNestedField } from "@/utils/updateNestedField";
import { showSuccess } from "@/utils/toastUtils";

export function useWorkOrderActions(mutate?: KeyedMutator<any>) {
  // Optimistic update wrapper
  const wrap = <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    optimisticUpdate?: (data: any, ...args: Parameters<T>) => any,
    onSuccess?: (result: Awaited<ReturnType<T>>) => void
  ) => {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      if (mutate && optimisticUpdate) {
        mutate((current: any) => {
          if (!current) return current;
          return optimisticUpdate(current, ...args);
        }, false);
      }

      const result = await fn(...args);

      if (onSuccess) onSuccess(result); // show toast
      if (mutate) mutate(); // revalidate with server response
      return result as ReturnType<T>;
    };
  };

  return {
    // ---- Time Logs ----
    addTimeLog: wrap(
      (id: string, log: { userId: string; timeSpent: number; description: string }) =>
        addTimeLog(id, log),
      (current, _id, log) => ({
        ...current,
        timeLogs: [...(current.timeLogs || []), log],
      })
    ),

    // ---- Travel Logs ----
    addTravelLog: wrap(
      (id: string, log: { userId: string; travelTime: number; note: string }) =>
        addTravelLog(id, log),
      (current, _id, log) => ({
        ...current,
        travelLogs: [...(current.travelLogs || []), log],
      })
    ),

    updateTimeLog: wrap(
      (id: string, logId: string, updates: any) =>
        updateTimeLog(id, logId, updates),
      (current, _id, logId, updates) => ({
        ...current,
        timeLogs: current.timeLogs.map((log: any) =>
          log._id === logId ? { ...log, ...updates } : log
        ),
      })
    ),

    deleteTimeLog: wrap(
      (id: string, logId: string) => deleteTimeLog(id, logId),
      (current, _id, logId) => ({
        ...current,
        timeLogs: current.timeLogs.filter((log: any) => log._id !== logId),
      })
    ),

    updateTravelLog: wrap(
      (id: string, logId: string, updates: any) =>
        updateTravelLog(id, logId, updates),
      (current, _id, logId, updates) => ({
        ...current,
        travelLogs: current.travelLogs.map((log: any) =>
          log._id === logId ? { ...log, ...updates } : log
        ),
      })
    ),

    deleteTravelLog: wrap(
      (id: string, logId: string) => deleteTravelLog(id, logId),
      (current, _id, logId) => ({
        ...current,
        travelLogs: current.travelLogs.filter((log: any) => log._id !== logId),
      })
    ),

    // ---- Attach Procedure ----
    attachProcedure: wrap(
      (id: string, procedureId: string) =>
        assignProcedureToWorkOrder(id, procedureId),
      (current) => current
    ),

    // ---- Update Task Results ----
    updateTaskResults: wrap(
      (id: string, procedureId: string, results: any[]) =>
        updateProcedureResults(id, procedureId, results),
      (current, _id, _procedureId, results) =>
        updateNestedField(current, "procedure.taskResults", results)
    ),

    // ---- Delete Procedure ----
    deleteProcedure: wrap(
      (id: string, procedureId: string) => removeProcedure(id, procedureId),
      (current, _id, procedureId) => ({
        ...current,
        procedures: current.procedures?.filter((p: { _id: string; }) => p._id !== procedureId) || [],
      })
    ),

    // ---- Add Part ----
    addPart: wrap(
      (id, partId, quantity) =>
        addPartToWorkOrder(id, partId, quantity),
      (current, _id, partId, quantity) =>
        updateNestedField(current, "partsUsed", [
          ...(current?.partsUsed || []),
          { partId, quantity }
        ]),
      () => showSuccess("Part added successfully")
    ),

    // ---- Update Part ----
    updatePart: wrap(
      (id, partId, updates) =>
        updatePartUsed(id, partId, updates),
      (current, _id, partId, updates) =>
        updateNestedField(
          current,
          "partsUsed",
          (current?.partsUsed || []).map((p: any) =>
            (p.partId === partId || p.partId?._id === partId)
              ? { ...p, ...updates }
              : p
          )
        ),
      () => showSuccess("Part removed successfully")
    ),

    // ---- Delete Part ----
    deletePart: wrap(
      (id, partId) => deletePartFromWorkOrder(id, partId),
      (current, _id, partId) =>
        updateNestedField(
          current,
          "partsUsed",
          (current?.partsUsed || []).filter(
            (p: any) => p.partId !== partId && p.partId?._id !== partId
          )
        )
    ),

    // ---- Add Test Equip ----
    addTestEquip: wrap(
      (id, equipmentId) => addTestEquipToWorkOrder(id, equipmentId),
      (current, _id, equipmentId) =>
        updateNestedField(current, "testEquipmentUsed", [
          ...(current?.testEquipmentUsed || []),
          { equipmentId }
        ])
    ),

    // ---- Delete Test Equip ----
    deleteTestEquip: wrap(
      (id, equipmentId) => removeTestEquipFromWorkOrder(id, equipmentId),
      (current, _id, equipmentId) =>
        updateNestedField(
          current,
          "testEquipmentUsed",
          (current?.testEquipmentUsed || []).filter(
            (item: any) =>
              item.equipmentId !== equipmentId &&
              item.equipmentId?._id !== equipmentId
          )
        )
    ),
  };
}

