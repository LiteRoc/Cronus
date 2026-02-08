// src/config/coverageProfiles.js
export const COVERAGE_PROFILES = {
  FSC:   { labor: true,  travel: true,  parts: true  },
  PMWP:  { labor: false, travel: false, parts: false },
  PMO:   { labor: false, travel: false, parts: false },
  LBR:   { labor: true,  travel: true,  parts: false },
  PARTS: { labor: false, travel: false, parts: true  },
  HYB:   { labor: true,  travel: false, parts: true  },
};