// src/types/Procedure.ts

import type { Task } from "./Task";
import type { TaskResult } from "./WorkOrder";

// Represents a procedure, which groups multiple tasks and their results
export interface Procedure {
  _id: string; // MongoDB ID for the procedure
  name: string; // Name of the procedure
  tasks: Task[]; // List of associated tasks
  taskResults: TaskResult[]; // Results for the tasks in this procedure
  createdAt: string; // Timestamp when the procedure was created
  updatedAt: string; // Timestamp when the procedure was last updated
};