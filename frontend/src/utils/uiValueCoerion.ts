// src/utils/uiValueCoercion.ts
export const asNumberInput = (v: unknown): number | "" =>
  typeof v === "number" ? v : "";

export const fromNumberInput = (s: string): number | null =>
  s === "" ? null : Number(s);