//src/types/Task.ts
// Represents an individual task
export interface Task {
  _id: string; // MongoDB ID for the task
  description: string; // Task description
  type: "passfail" | "measure" | "comment"; // Task type
  minValue?: number; // Optional minimum value (for measurement)
  maxValue?: number; // Optional maximum value (for measurement)
  unit: string;
  createdAt: string; // Timestamp when the task was created
  updatedAt: string; // Timestamp when the task was last updated
};