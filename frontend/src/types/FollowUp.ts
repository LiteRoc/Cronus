export type FollowUpStatus = "open" | "completed" | "cancelled";
export type FollowUpPriority = "low" | "normal" | "high";

export interface FollowUp {
  _id: string;
  facilityId: string;
  title: string;
  description: string;
  dueAt: string;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  assignedTo: string;
  contactId: string | null;
  completedAt: string | null;
  completedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
}

export interface FollowUpInput {
  title: string;
  description?: string;
  dueAt: string;
  priority: FollowUpPriority;
  assignedTo: string;
  contactId?: string | null;
}

export interface FollowUpAssignee {
  _id: string;
  name: string;
  role: "admin" | "technician";
}

export interface FollowUpListParams {
  search?: string;
  status?: FollowUpStatus;
  assignedTo?: string;
  contactId?: string;
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
  page?: number;
  limit?: number;
}

export interface FollowUpListResponse {
  followUps: FollowUp[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
