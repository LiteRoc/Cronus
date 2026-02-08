// src/utils/asOfDates.ts

const pad = (n: number) => String(n).padStart(2, "0");

export function toYyyyMmDd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function endOfLastMonth(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 0);
}

export function endOfLastQuarter(now = new Date()) {
  const q = Math.floor(now.getMonth() / 3); // 0..3
  const startThisQ = new Date(now.getFullYear(), q * 3, 1);
  return new Date(startThisQ.getFullYear(), startThisQ.getMonth(), 0);
}

export function endOfLastYear(now = new Date()) {
  return new Date(now.getFullYear(), 0, 0);
}