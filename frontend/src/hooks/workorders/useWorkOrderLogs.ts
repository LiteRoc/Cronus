// src/hooks/workorders/useWorkOrderLogs.ts
// deprecated
import {
  addTimeLog,
  addTravelLog,
  updateTimeLog,
  updateTravelLog,
  deleteTimeLog,
  deleteTravelLog,
} from "@/services/workOrderAPI";
import { KeyedMutator } from "swr";
import { NewTimeLog, NewTravelLog, WorkOrder } from "@/types";

export const useWorkOrderLogs = (workOrderId: string, userId: string, mutate: KeyedMutator<WorkOrder>) => {
  // ---- Time Logs ----
  const addTime = async (log: NewTimeLog) => {
    await addTimeLog(workOrderId, { ...log, userId });
    mutate(); // revalidate
  };

  const updateTime = async (logId: string, updates: Partial<{ timeSpent: number; description: string }>) => {
    await updateTimeLog(workOrderId, logId, updates);
    mutate();
  };

  const removeTime = async (logId: string) => {
    await deleteTimeLog(workOrderId, logId);
    mutate();
  };

  // ---- Travel Logs ----
  const addTravel = async (log: NewTravelLog) => {
    await addTravelLog(workOrderId, { ...log, userId });
    mutate();
  };

  const updateTravel = async (logId: string, updates: Partial<{ travelTime: number; note?: string }>) => {
    await updateTravelLog(workOrderId, logId, updates);
    mutate();
  };

  const removeTravel = async (logId: string) => {
    await deleteTravelLog(workOrderId, logId);
    mutate();
  };

  return {
    addTime,
    updateTime,
    removeTime,
    addTravel,
    updateTravel,
    removeTravel,
  };
};