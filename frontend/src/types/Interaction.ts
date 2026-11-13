export type InteractionType =
  | "meeting"
  | "call"
  | "email"
  | "site_visit"
  | "note";

export type InteractionDirection =
  | "inbound"
  | "outbound"
  | "internal";

export type InteractionVisibility =
  | "operational"
  | "restricted";

export interface Interaction {
  _id: string;
  facilityId: string;

  type: InteractionType;
  occurredAt: string;
  summary: string;
  body: string;
  direction: InteractionDirection;
  visibility: InteractionVisibility;

  contactIds: string[];

  createdBy: string;
  updatedBy: string;

  createdAt: string;
  updatedAt: string;

  archivedAt: string | null;
  archivedBy: string | null;

  __v?: number;
}

export interface InteractionInput {
  type: InteractionType;
  occurredAt: string;
  summary: string;
  body?: string;
  direction: InteractionDirection;
  visibility?: InteractionVisibility;
  contactIds?: string[];
}

export interface InteractionListParams {
  search?: string;
  type?: InteractionType;
  direction?: InteractionDirection;
  visibility?: InteractionVisibility;
  contactId?: string;
  occurredFrom?: string;
  occurredTo?: string;
  page?: number;
  limit?: number;
}

export interface InteractionListResponse {
  interactions: Interaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
