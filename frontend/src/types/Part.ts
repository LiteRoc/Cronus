export interface Part {
  _id: string;
  partNumber: string;
  description: string;
  quantityOnHand: number;
  price?: number; // Optional: Include if needed
  location?: string; // Optional: Include if needed
  supplier?: string; // Optional: Include if needed
  manufacturer?: string;
  compatibleAssets: string;
  createdAt: string; // Timestamp when the procedure was created
  updatedAt: string; // Timestamp when the procedure was last updated
};