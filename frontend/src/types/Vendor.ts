// Secured shared Vendor API projection. Contact fields are flat.
export type VendorCategory = 'OEM' | 'ISO' | 'Distributor' | 'Consulting' | 'Rental' | 'Other';

export interface Vendor {
  _id: string;
  name: string;
  category?: VendorCategory;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  services?: string[];
  territories?: string[];
  // Returned only to administrators; absent from technician responses.
  preferredVendor?: boolean;
  notes?: string;
}

// Admin business-field changes only; ownership, IDs and audit are server-owned.
export type VendorUpdate = Partial<Omit<Vendor, '_id'>>;
