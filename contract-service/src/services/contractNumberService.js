// src/services/contractNumberService.js
import Counter from "../models/Counter.js";
import { getJulianKeyNY } from "../utils/contractNumber.js";

/**
 * Atomically returns the next contract number for today:
 * 2026023-01, 2026023-02, etc.
 */
export async function generateContractNumber({ date = new Date() } = {}) {
  const key = getJulianKeyNY(date);

  const updated = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const suffix = String(updated.seq).padStart(2, "0");
  return `${key}-${suffix}`;
}