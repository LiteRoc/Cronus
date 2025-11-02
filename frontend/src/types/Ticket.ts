// src/types/Ticket.ts

export type Ticket = {
  _id: string;
  type: "service" | "consumable";
  status: "Open" | "Needs Info" | "Approved" | "Converted" | "Rejected" | "Closed";
  priority: "Low" | "Normal" | "High" | "Critical";
  subject: string;
  description?: string;
  assetId?: { _id: string; ctrlNumber?: string; manufacturer?: string; model?: string };
  workOrderId?: string | null;
  requestedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type TicketFilters = Partial<{
  type: "service" | "consumable";
  status: Ticket["status"];
  assetId: string;
  q: string;
}>;