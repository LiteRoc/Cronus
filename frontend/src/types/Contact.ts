export type ContactStatus = "active" | "inactive" | "archived";

export interface Contact {
  _id: string;
  organizationId: string;
  primaryFacilityId: string;
  facilityIds: string[];
  firstName: string;
  lastName: string;
  title: string;
  functionalDescription: string;
  email: string;
  phone: string;
  notes: string;
  status: ContactStatus;
  createdBy: string;
  updatedBy: string;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ContactInput = Pick<Contact, "firstName" | "lastName"> &
  Partial<Pick<Contact, "title" | "functionalDescription" | "email" | "phone" | "notes" | "status">> & {
    facilityIds: string[];
  };

export interface ContactDuplicateMatch {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  matchedOn: Array<"email" | "name" | "phone">;
}

export interface ContactDuplicateWarning {
  code: "possible_duplicate";
  matchedOn?: Array<"email" | "name" | "phone">;
  matches?: ContactDuplicateMatch[];
  hasRestrictedMatches?: true;
}

export interface ContactMutationResponse {
  contact: Contact;
  warnings: ContactDuplicateWarning[];
}

export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
