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
export function updateNestedField<T extends object>(
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
}