// src/utils/contractNumbers.js
import { DateTime } from "luxon";

/**
 * Returns day-of-year in America/New_York for a given JS Date (or now).
 */
export function getDayOfYearNY(date = new Date()) {
  const dt = DateTime.fromJSDate(date, { zone: "America/New_York" });
  return dt.ordinal; // 1..365/366
}

/**
 * Returns YYYYDDD (e.g., 2026023) using America/New_York.
 */
export function getJulianKeyNY(date = new Date()) {
  const dt = DateTime.fromJSDate(date, { zone: "America/New_York" });
  const year = dt.year;
  const doy = String(dt.ordinal).padStart(3, "0");
  return `${year}${doy}`;
}