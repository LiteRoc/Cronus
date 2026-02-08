// src/types/ContractValue.ts

export type ContractValueTimelineEvent = {
  amendmentNumber: string;
  effectiveDate: string;     // ISO string
  description?: string;
  changeType: "add" | "remove" | "update" | string; // keep string if backend may add types later
  annualDelta: number;       // signed annual delta
  annualValueAfter: number;  // running total after applying event
  isBaseLine?: boolean;
  amendmentId?: string;
};

export type ContractValueResponse = {
  contractId: string;
  contractNumber?: string;
  asOf: string;                 // ISO string
  annualBase: number;
  annualDeltaApplied: number;
  annualValueAsOf: number;
  remainingTermValue: number;
  proratedRangeValue: number | null;

  appliedEventsAsOf: ContractValueTimelineEvent[];
  fullTimeline: ContractValueTimelineEvent[];
};
