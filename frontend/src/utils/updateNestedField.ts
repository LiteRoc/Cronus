// src/utils/updateNestedFields.ts

/**
 * Immutably updates a nested field in an object using dot notation.
 * Example: updateNestedField(asset, "maintenanceSchedule.frequency", "Monthly")
 */

/**import _set from 'lodash.set';
*
*export function updateNestedField<T extends object>(obj: T, fieldPath: string, value: any): T {
*  const copy = structuredClone(obj); // or use JSON.parse(JSON.stringify(obj)) if structuredClone is unavailable
*  _set(copy, fieldPath, value);
*  return copy;
*}
*/
/*export function updateNestedField<T extends object>(
  obj: T,
  fieldPath: string,
  value: any
): T {
  const keys = fieldPath.split(".");
  const lastKey = keys.pop();

  if (!lastKey) return obj;

  // Build up the nested object structure from bottom up
  let nestedUpdate: any = { [lastKey]: value };

  for (let i = keys.length - 1; i >= 0; i--) {
    nestedUpdate = { [keys[i]]: { ...(obj as any)[keys[i]], ...nestedUpdate } };
    obj = { ...(obj as any), ...nestedUpdate }; // update top level at each loop
  }

  return { ...obj, ...nestedUpdate };
}*/
export function updateNestedField<T extends object>(
  obj: T,
  fieldPath: string,
  value: any
): T {
  const keys = fieldPath.split(".");

  const clone = structuredClone(obj); // deep clone (Node 17+/modern browsers)
  let current: any = clone;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const isArrayIndex = /^\d+$/.test(key);

    if (isArrayIndex) {
      const idx = Number(key);
      current = current[idx];
    } else {
      if (!(key in current)) current[key] = {};
      current = current[key];
    }
  }

  const lastKey = keys[keys.length - 1];
  const isArrayIndex = /^\d+$/.test(lastKey);
  if (isArrayIndex) {
    current[Number(lastKey)] = value;
  } else {
    current[lastKey] = value;
  }

  return clone;
}