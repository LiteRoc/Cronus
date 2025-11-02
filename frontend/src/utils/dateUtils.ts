// src/utils/dateUtils.ts

export const formatISODate = (date?: string | Date): string => {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0]; // returns 'YYYY-MM-DD'
};