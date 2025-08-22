export interface WorkOrder {
  _id: string;
  assetId: Asset | null;
  description: string;
  status: "Open" | "In Progress" | "Closed";
  scheduledDate: string;
  completionDate?: string;
  assignedTo: AssignedTo;
  timeLogs: TimeLog[];
  travelLogs: TravelLog[];
  partsUsed: PartsUsed[];
  testEquipmentUsed: Asset[];
  updatedAt: string;
  workOrderNumber: number;
  workOrderType: string;
  dueDate: string;
  requestDate: string;
  procedure?: Procedure;
  taskResults: TaskResult[]; // Store task results at the work order level
};

export interface AssignedTo {
  _id: string;
  username: string;
  email: string;
};

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
  
export interface Part {
  _id: string;
  partNumber: string;
  description: string;
  quantityOnHand: number;
  price?: number; // Optional: Include if needed
  location?: string; // Optional: Include if needed
  supplier?: string; // Optional: Include if needed
};

export interface PartsUsed {
  partId: Part; // Populate returns full part object
  quantity: number;
};

export interface EquipmentTemplate {
  _id: string,
  di: string,
  manufacturer: string,
  model: string,
  description: string,
  equipmentClass: string,
  brandName?: string,
  issuingAgency?: string,
  fdaProductCode?: string,
  gmdnTerm?: string,
  gmdnCode?: string,
  classificationName?: string,
  kind: string,
  alarm: boolean,
  hipaa: boolean,
  autoAddPMProcedure: boolean,
  requirePmPlan: boolean,
  excludeFromLifecycle: boolean,
  excludeFromAEM: boolean,
  manufacturerRecommendedPMFrequency: number,
  verified: boolean
};

export interface TemplateListResponse {
  templates: EquipmentTemplate[];
  totalCount: number;
};

export interface Asset {
  _id: string;
  ctrlNumber: string;
  manufacturer: string;
  model: string;
  category: "Biomed" | "Test Equipment";
  notes?: string;
  maintenanceSchedule?: MaintenanceSchedule;
  status: 'Active' | 'Inactive';
  serialNumber?: string;
  workOrders: WorkOrder[];
  createdAt?: string;
  updatedAt?: string;
  kind?: string;
};

export interface MaintenanceSchedule {
  frequency: "Monthly" | "Quarterly" | "Yearly";
  lastMaintenance?: string;
  nextMaintenance?: string; // Make this optional
  procedure?: Procedure;
}

export interface WorkOrderStatus {
  name: string;
  value: number;
};

export interface AssetStatus {
  name: string;
  value: number;
};

export interface TechnicianTimeLog {
  _id: string;
  totalTime: number;
};

  // Represents an individual task
export interface Task {
  _id: string; // MongoDB ID for the task
  description: string; // Task description
  type: "Pass/Fail" | "Measurement" | "Comment"; // Task type
  minValue?: number; // Optional minimum value (for measurement)
  maxValue?: number; // Optional maximum value (for measurement)
  unit: string;
  createdAt: string; // Timestamp when the task was created
  updatedAt: string; // Timestamp when the task was last updated
};

// Represents the result of a task for a specific procedure
export interface TaskResult {
  taskId: string; // Reference to the associated Task
  result: boolean | number | string | null; // Either Pass/Fail (boolean) or a measurement (number)
  submittedBy: string;
  submittedByName: string,
  timestamp: string; // Timestamp of when the result was recorded
  _id?: string; // Optional MongoDB ID for the task result
};

// Represents a procedure, which groups multiple tasks and their results
export interface Procedure {
  _id: string; // MongoDB ID for the procedure
  name: string; // Name of the procedure
  tasks: Task[]; // List of associated tasks
  taskResults: TaskResult[]; // Results for the tasks in this procedure
  createdAt: string; // Timestamp when the procedure was created
  updatedAt: string; // Timestamp when the procedure was last updated
};

export interface WorkOrderSummary {
  open: number;
  closed: number;
  overdue: number;
};

export interface AssetSummary {
  active: number;
  inactive: number;
  upcomingMaintenance: number;
};

export interface PartsSummary {
  inStock: number;
  lowStock: number;
};

export interface TechnicianPerformance {
    name: string;
    totalHours: number;
};

export type FilteredType = "assets" | "workOrders";

export const VALID_ROLES = ["admin", "tech", "customer", "viewer"] as const;
export type Role = typeof VALID_ROLES[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  username: string;
};


