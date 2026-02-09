// src/types/WorkOrders.ts

export interface WorkOrder {
  _id: string;
  workOrderNumber: number;
  assetId: {
    _id: string;
    ctrlNumber: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
  };
  workOrderType: string;
  description: string;
  status: 'Open'|'In_Progress'|'On_Hold'|'Completed'|'Cancelled'|'Closed';
  priority: 'Low'|'Normal'|'High'|'Urgent';
  requestDate: string;
  procedures?: WorkOrderProcedure[];
  createdAt: string;
  scheduledDate: string;
  completionDate?: string;
  assignedTo: AssignedTo | string;
  timeLogs: TimeLog[];
  travelLogs: TravelLog[];
  partsUsed: PartsUsed[];
  testEquipmentUsed: TestEquipmentUsed[];
  updatedAt: string;
  dueDate: string;
  taskResults: TaskResult[]; // Store task results at the work order level
};

// NEW: payload shape for creating a WO (IDs, not objects)
export interface WorkOrderCreatePayload {
  assetId: string;
  title?: string;
  description?: string;
  scheduledDate?: string;
  workOrderType?: 'Corrective Maintenance' | 'Planned Maintenance';
  priority?: 'low'|'normal'|'high'|'urgent';
  assignedTo?: string; // <- userId string
};

export type WorkOrderFilters = {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  assignedTo?: string;
  q?: string;
  start?: string;
  end?: string;
};

export interface AssignedTo {
  _id: string;
  username: string;
  email: string;
};

export interface NewTimeLog {
  timeSpent: number;
  description: string;
};

export interface NewTravelLog {
  travelTime: number;
  note?: string;
}

export interface TimeLog {
  _id: string,
  userId: {
    _id: string;
    username: string;
    email: string;
  }
  timeSpent: number;
  description: string;
  timestamp: string;
};
  
export interface TravelLog {
  userId: {
    _id: string;
    username: string;
    email: string;
  }
  travelTime: number;
  timestamp: string;
  _id: string;
};

export type PopulatedPart = {
  _id: string;
  partNumber?: string;
  description?: string;
};

export type PartsUsed = {
  _id?: string;
  partId: string | PopulatedPart;
  quantity: number;
  note?: string;
  usedBy?: { _id: string; name?: string };
  usedAt?: string;
};

// partial embedded version of the Procedure
export interface WorkOrderProcedure {
  _id: string;
  name: string;
  taskResults: TaskResult[];
}

// Represents the result of a task for a specific procedure
export interface TaskResult {
  taskId: string; // Reference to the associated Task
  label: string,
  type: "pass/fail" | "measurement" | "comment"; // Task type
  value: boolean | number | string | null; // Either Pass/Fail (boolean) or a measurement (number)
  unitOfMeasure?: string | null,
  passed?: boolean | null,
  comment?: string,
  minValue?: number; // Optional minimum value (for measurement)
  maxValue?: number; // Optional maximum value (for measurement)
  submittedBy: string;
  submittedAt: string,
  timestamp: string; // Timestamp of when the result was recorded
  _id?: string; // Optional MongoDB ID for the task result
};

export type PopulatedTestEquipment = {
  _id: string;
  assetTag?: string;
  model?: string;
  manufacturer?: string;
};

export type TestEquipmentUsed = {
  _id?: string;
  equipmentId: string | PopulatedTestEquipment;
  usedBy?: { _id: string; name?: string };
  usedAt?: string;
  note?: string;
};

