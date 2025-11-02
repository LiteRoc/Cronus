//src/services/workOrderAPI.ts

import apiClient from "./apiClient";
import { WorkOrder, WorkOrderCreatePayload, WorkOrderFilters, Procedure, TaskResult, Asset, TimeLog, TravelLog } from "@/types";

export async function fetchWorkOrders(
  facilityId: string | undefined,
  filters: WorkOrderFilters,
  page: number,
  pageSize: number
) {
  // Build query params
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (pageSize) params.set("limit", String(pageSize));
  Object.entries(filters || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
  });

  // GET /workorders
  const { data } = await apiClient.get(`/workorders?${params.toString()}`, {
    // facility header is injected by axios interceptor from FacilityContext
    headers: facilityId ? { "x-facility-id": facilityId } : undefined,
  });

  // Normalize to match your useAssets expectations
  // Backend returns: { items, pagination: { page, limit, total, pages } }
  const items = data?.items ?? [];
  const pagination = data?.pagination ?? {};
  return {
    workOrders: items,
    currentPage: pagination.page ?? 1,
    totalPages: pagination.pages ?? 1,
    totalWorkOrders: pagination.total ?? items.length,
  };
}

export const workOrdersByStatus = async (status: string): Promise<WorkOrder[]> => {
  try {
    const response = await apiClient.get<WorkOrder[]>(`/workorders?status=${status}`);
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
    const response = await apiClient.get<WorkOrder[]>(`/workorders?type=${type}`);
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

export const fetchWorkOrder = async (id: string): Promise<WorkOrder> => {
  try {
    const response = await apiClient.get<WorkOrder>(`/workorders/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error in getWorkOrderById:', error);
    throw error;
  }
};

export const addWorkOrder = async (newWorkOrder: Partial<WorkOrderCreatePayload>) => {
  try {
    const response = await apiClient.post<WorkOrder>("/workorders", newWorkOrder);
    return response.data;
  } catch (err) {
    console.error("Error creating work order:", err);
    throw err;
  }
};

export const updateWorkOrder = async (id: string, updates: Partial<WorkOrder>): Promise<WorkOrder> => {
  const response = await apiClient.put<WorkOrder>(`/workorders/${id}`, updates);
  return response.data;
};

export const removeWorkOrder = async (id: string) => apiClient.delete(`/workorders/${id}`);

export const addTimeLog = async (
  workOrderId: string,
  timeLog: { userId: string, timeSpent: number; description: string }
): Promise<void> => {
  console.log('Receiving time log:', timeLog);
  await apiClient.post(`/workorders/${workOrderId}/time-logs`, {
    //userId: "YOUR_USER_ID", // Replace with actual user ID (e.g., from context)
    ...timeLog,
  });
};

export const addTravelLog = async (
  workOrderId: string,
  travelLog: { userId: string; travelTime: number; /*timestamp: string*/ }
) => {
  const response = await apiClient.post(`/workorders/${workOrderId}/travel-logs`, travelLog);
  return response.data;
};

export const updateTimeLog = async (workOrderId: string, timeLogId: string, updates: Partial<TimeLog>): Promise<TimeLog> => {
  const response = await apiClient.patch<TimeLog>(`/workorders/${workOrderId}/time-logs/${timeLogId}`, updates);
  return response.data;
}

export const updateTravelLog = async (workOrderId: string, travelLogId: string, updates: Partial<TravelLog>): Promise<TravelLog> => {
  const response = await apiClient.patch<TravelLog>(`/workorders/${workOrderId}/travel-logs/${travelLogId}`, updates);
  return response.data;
}

export const deleteTimeLog = async (workOrderId: string, timeLogId: string) => apiClient.delete(`/workorders/${workOrderId}/time-logs/${timeLogId}`);

export const deleteTravelLog = async (workOrderID: string, travelLogId: string) => apiClient.delete(`/workorders/${workOrderID}/travel-logs/${travelLogId}`);

export const assignProcedureToWorkOrder = async (
  workOrderId: string,
  procedureId: string
): Promise<void> => {
  const response = await apiClient.patch(`/workorders/${workOrderId}/procedure`, {
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
          label: result.label,
          type: result.type,
          value: result.value ?? null,
          passed: result.passed ?? null,
          comment: result.comment ?? '',
          unitOfMeasure: result.unitOfMeasure,
          submittedBy: result.submittedBy,
          submittedAt: new Date(),
          ...(result.timestamp && { timestamp: result.timestamp }),
      })),
  };

  console.log("Payload to API:", payload);

  const response = await apiClient.patch(
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
  const response = await apiClient.put<Procedure>(
    `/workorders/${workOrderId}/procedure`,
    { taskResults }
  );
  return response.data;
};

export const removeProcedure = async (workOrderId: string, procedureId: string) => 
  (apiClient.delete(`/workorders/${workOrderId}/procedure/${procedureId}`));

export const addTestEquipToWorkOrder = async (
  workOrderId: string,
  equipmentId: string
) => {
  const { data } = await apiClient.post<Asset>(
    `/workorders/${workOrderId}/test-equipment`,
    { equipmentId }
  );
  return data;
};

export const removeTestEquipFromWorkOrder = async (workOrderId: string, testEquipId: string) => {
  const { data } = await apiClient.delete(`/workorders/${workOrderId}/test-equipment/${testEquipId}`);
  return data;
}

export const getWorkOrderParts = async (workOrderId: string) => {
  const { data } = await apiClient.get(`/workorders/${workOrderId}/parts`);
  return data;
};

export const addPartToWorkOrder = async (workOrderId: string, partId: string, quantity: number) => {
  const { data } = await apiClient.post(`/workorders/${workOrderId}/parts`, { partId, quantity });
  return data;
};

export const updatePartUsed = async (
  workOrderId: string,
  partId: string,
  update: Partial<{ quantity: number }>
) => {
  const { data } = await apiClient.put(`/workorders/${workOrderId}/parts/${partId}`, update);
  return data;
};

export const deletePartFromWorkOrder = async (workOrderId: string, partId: string) => {
  const { data } = await apiClient.delete(`/workorders/${workOrderId}/parts/${partId}`);
  return data;
};

