// src/types/coverage.ts
export type CoverageCode =
  | "FSC"    // Full Service Coverage (CAM takes all risk)
  | "PMWP"   // PM with Parts (Vendor)
  | "LBR"    // Labor only (CAM labor, no parts)
  | "PARTS"  // Parts only
  | "PMO"    // Preventive maintenance only
  | "HYB";   // Hybrid / custom
