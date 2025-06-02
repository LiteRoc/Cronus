import axios from "axios";
import { Asset, WorkOrder, Part, Procedure, TaskResult, Equipment } from "../types/types";

const api = axios.create({
  baseURL: "http://localhost:4000/", // Backend API URL
  headers: {
    "Content-Type": "application/json",
  },
});

// Define the function to fetch dashboard data
export const fetchDashboardData = async () => {
  try {
    const response = await api.get("/dashboard");
    return response.data;
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    throw error;
  }
};

export const createWorkOrder = async (newWorkOrder: Partial<WorkOrder>) => {
  try {
    const response = await api.post("/workorders", newWorkOrder);
    return response.data;
  } catch (err) {
    console.error("Error creating work order:", err);
    throw err;
  }
};

export const getWorkOrder = async (id: string): Promise<WorkOrder> => {
  const response = await api.get<WorkOrder>(`/workorders/${id}`);
  return response.data;
};

export const updateWorkOrder = async (id: string, updates: Partial<WorkOrder>): Promise<WorkOrder> => {
  const response = await api.put<WorkOrder>(`/workorders/${id}`, updates);
  return response.data;
};

export const assetsByStatus = async (status: string): Promise<Asset[]> => {
  console.log(`Fetching assets with status: ${status}`);
  const response = await api.get<{ assets: Asset[] }>(`/assets?status=${status}`);
  console.log('API Resonose:', response.data);
  return response.data.assets; // Ensure only the array is returned
}

export const workOrdersByStatus = async (status: string): Promise<WorkOrder[]> => {
  try {
    const response = await api.get<WorkOrder[]>(`/workorders?status=${status}`);
    if (!Array.isArray(response.data)) {
      console.error("Invalid response format:", response);
      throw new Error("Expected an array of work orders");
    }
    return response.data;
  } catch (error) {
    console.error("Error in workOrdersByStatus:", error);
    throw error;
  }
};

export const getWorkOrderById = async (id: string): Promise<WorkOrder> => {
  try {
    const response = await api.get<WorkOrder>(`/workorders/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error in getWorkOrderById:', error);
    throw error;
  }
}

export const getAssetById = async (id: string): Promise<Asset> => {
  try {
    const response = await api.get<Asset>(`/assets/${id}`);
    return response.data
  } catch (error) {
    console.error('Error is getAssetById:', error);
    throw error;
  }
}

// Update asset
export const updateAsset = async (id: string, updatedAsset: Partial<Asset>) => {
  await api.put(`/assets/${id}`, updatedAsset);
};

export const addTimeLog = async (
  workOrderId: string,
  timeLog: { userId: string, timeSpent: number; description: string }
): Promise<void> => {
  console.log('Receiving time log:', timeLog);
  await api.patch(`/workorders/${workOrderId}/timeLogs`, {
    //userId: "YOUR_USER_ID", // Replace with actual user ID (e.g., from context)
    ...timeLog,
  });
};

export const addTravelLog = async (
  workOrderId: string,
  travelLog: { userId: string; travelTime: number; /*timestamp: string*/ }
) => {
  const response = await api.patch(`/workorders/${workOrderId}/travelLogs`, travelLog);
  return response.data;
};


export const getParts = async (): Promise<Part[]> => {
  const response = await api.get<Part[]>("/parts");
  return response.data;
};

export const addPartToWorkOrder = async (workOrderId: string, partId: string, quantity: number) => {
  const response = await api.patch(`/workorders/${workOrderId}/parts`, {
    partId,
    quantity,
  });
  return response.data;
};

export const assignProcedureToWorkOrder = async (
  workOrderId: string,
  procedureId: string
): Promise<void> => {
  const response = await api.patch(`/workorders/${workOrderId}/procedure`, {
    procedureId,
  });
  return response.data;
};

export const getProcedures = async (): Promise<Procedure[]> => {
  const response = await api.get<Procedure[]>("/procedures");
  return response.data;
}

export const updateProcedureResults = async (
  workOrderId: string,
  procedureId: string,
  taskResults: TaskResult[]
): Promise<void> => {
    const payload = {
      taskResults: taskResults.map((result) => ({
          taskId: result.taskId,
          result: result.result,
          ...(result.timestamp && { timestamp: result.timestamp }),
      })),
  };
  console.log("Payload to API:", payload);

  const response = await api.patch(
    `/workorders/${workOrderId}/procedure/${procedureId}/task-results`,
    { taskResults }
  );
  return response.data;
};

export const addProcedure = async (
  workOrderId: string,
  procedureId: string
): Promise<Procedure> => {
  const response = await api.patch(`/workorders/${workOrderId}/procedures`, { procedureId });
  return response.data;
}

// Reuse this to assign and update a procedure on a work order
export const updateProcedureOnWorkOrder = async (
  workOrderId: string,
  taskResults: TaskResult[]
): Promise<Procedure> => {
  const response = await api.put<Procedure>(
    `/workorders/${workOrderId}/procedure`,
    { taskResults }
  );
  return response.data;
};

export const addTestEquipToWorkOrder = async (
  workOrderId: string,
  equipmentId: string
): Promise<Equipment> => {
  const response = await api.patch<Equipment>(
    `/workorders/${workOrderId}/test-equipment`,
    { equipmentId }
  );
  return response.data;
}

export const downloadWorkOrderPDF = async (
  workOrderNumber: string,
) => {
  const response = await api.get(`/reports/workorders/${workOrderNumber}/pdf`, { responseType: 'blob' });
  return response.data;
}


export default api;
