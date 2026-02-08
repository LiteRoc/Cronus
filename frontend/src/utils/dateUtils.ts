// src/utils/dateUtils.ts

export const formatISODate = (date?: string | Date): string => {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0]; // returns 'YYYY-MM-DD'
};

export function parseDateish(value: unknown): Date | null {
  if (!value) return null;

  // already a Date
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  // ISO string or any date string
  if (typeof value === "string") {
    // common case: "YYYY-MM-DD" (treat as local midnight)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(`${value}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // epoch
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // Mongo extended JSON: { $date: "..." }
  if (typeof value === "object" && value !== null && "$date" in (value as any)) {
    const d = new Date((value as any).$date);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function formatShortDate(value: unknown): string {
  const d = parseDateish(value);
  return d ? d.toLocaleDateString() : "—";
}

export const daysBetween = (a: Date, b: Date) => {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
};

export const ytdFraction = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  const elapsed = daysBetween(start, now);
  const total = daysBetween(start, end);
  return total ? elapsed / total : 0;
};
