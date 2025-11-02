import type { Facility } from "./Facility";

export interface User {
  id: string;                     // normalized (from `sub`)
  name?: string;
  username: string;
  email?: string;
  role: Role;
  facilityId?: string;
  facilities?: Facility[],
  departmentId?: string;

  // Optional token claims
  iat?: number;
  exp?: number;
};


export const VALID_ROLES = ["admin", "tech", "customer", "viewer"] as const;
export type Role = typeof VALID_ROLES[number];