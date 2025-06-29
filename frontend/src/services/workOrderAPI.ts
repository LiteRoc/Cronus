import axios from "axios";
import { WorkOrder, Procedure, TaskResult, Asset, TimeLog, TravelLog } from "../types/types";

const API = axios.create({
  baseURL: "http://localhost:4000/", // Backend API URL
  headers: {
    "Content-Type": "application/json",
  },
});

export const fetchWorkOrders = async (queryParams: Record<string, string>) => {
  const query = new URLSearchParams(queryParams).toString();
  const response = await API.get(`/workorders?${query}`);
  return response.data;
}

export const workOrdersByStatus = async (status: string): Promise<WorkOrder[]> => {
  try {
    const response = await API.get<WorkOrder[]>(`/workorders?status=${status}`);
    if (!Array.isArray(response.data)) {
      console.error("Invalid response format:", response);
      throw new Error("Expected an array of work orders");
    }
    console.log('API Resonose:', response.data);
    return response.data;
  } catch (error) {
    console.error("Error in workOrdersByStatus:", error);
    throw error;
  }
};

export const workOrderByType = async (type: string): Promise<WorkOrder[]> => {
  try {
    const response = await API.get<WorkOrder[]>(`/workorders?type=${type}`);
    if (!Array.isArray(response.data)) {
      console.error("Invalide response format:", response);
      throw new Error("Expected an array of work orders");
    }
    console.log('API Resonose:', response.data);
    return response.data;
  } catch (error) {
    console.error("Error in workOrdersByType:", error);
    throw error;
  }
};

export const getWorkOrderById = async (id: string): Promise<WorkOrder> => {
  try {
    const response = await API.get<WorkOrder>(`/workorders/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error in getWorkOrderById:', error);
    throw error;
  }
};

export const addWorkOrder = async (newWorkOrder: Partial<WorkOrder>) => {
  try {
    const response = await API.post("/workorders", newWorkOrder);
    return response.data;
  } catch (err) {
    console.error("Error creating work order:", err);
    throw err;
  }
};

export const updateWorkOrder = async (id: string, updates: Partial<WorkOrder>): Promise<WorkOrder> => {
  const response = await API.put<WorkOrder>(`/workorders/${id}`, updates);
  return response.data;
};

export const removeWorkOrder = async (id: string) => API.delete(`/workorders/${id}`);

export const addTimeLog = async (
  workOrderId: string,
  timeLog: { userId: string, timeSpent: number; description: string }
): Promise<void> => {
  console.log('Receiving time log:', timeLog);
  await API.patch(`/workorders/${workOrderId}/timeLogs`, {
    //userId: "YOUR_USER_ID", // Replace with actual user ID (e.g., from context)
    ...timeLog,
  });
};

export const addTravelLog = async (
  workOrderId: string,
  travelLog: { userId: string; travelTime: number; /*timestamp: string*/ }
) => {
  const response = await API.patch(`/workorders/${workOrderId}/travelLogs`, travelLog);
  return response.data;
};

export const updateTimeLog = async (workOrderId: string, timeLogId: string, updates: Partial<TimeLog>): Promise<TimeLog> => {
  const response = await API.patch<TimeLog>(`/workorders/${workOrderId}/timelogs/${timeLogId}`, updates);
  return response.data;
}

export const updateTravelLog = async (workOrderId: string, travelLogId: string, updates: Partial<TravelLog>): Promise<TravelLog> => {
  const response = await API.patch<TravelLog>(`/workorders/${workOrderId}/travellogs/${travelLogId}`, updates);
  return response.data;
}

export const deleteTimeLog = async (workOrderId: string, timeLogId: string) => API.delete(`/workorders/${workOrderId}/timelogs/${timeLogId}`);

export const deleteTravelLog = async (workOrderID: string, travelLogId: string) => API.delete(`/workorders/${workOrderID}/travellogs/${travelLogId}`);

export const assignProcedureToWorkOrder = async (
  workOrderId: string,
  procedureId: string
): Promise<void> => {
  const response = await API.patch(`/workorders/${workOrderId}/procedure`, {
    procedureId,
  });
  return response.data;
};

export const updateProcedureResults = async (
  workOrderId: string,
  procedureId: string,
  taskResults: TaskResult[]
): Promise<void> => {
    const payload = {
      taskResults: taskResults.map((result) => ({
          taskId: result.taskId,
          result: result.result,
          submittedBy: result.submittedBy,
          submittedByName: result.submittedByName,
          ...(result.timestamp && { timestamp: result.timestamp }),
      })),
  };

  console.log("Payload to API:", payload);

  const response = await API.patch(
    `/workorders/${workOrderId}/procedure/${procedureId}/task-results`,
    { taskResults }
  );
  return response.data;
};

// Reuse this to assign and update a procedure on a work order
export const updateProcedureOnWorkOrder = async (
  workOrderId: string,
  taskResults: TaskResult[]
): Promise<Procedure> => {
  const response = await API.put<Procedure>(
    `/workorders/${workOrderId}/procedure`,
    { taskResults }
  );
  return response.data;
};

export const addTestEquipToWorkOrder = async (
  workOrderId: string,
  equipmentId: string
): Promise<Asset> => {
  const response = await API.patch<Asset>(
    `/workorders/${workOrderId}/test-equipment`,
    { equipmentId }
  );
  return response.data;
};

export default API;