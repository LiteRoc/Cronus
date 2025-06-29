/**
 * Immutably updates a nested field in an object using dot notation.
 * Example: updateNestedField(asset, "maintenanceSchedule.frequency", "Monthly")
 */
export function updateNestedField<T extends object>(
  obj: T,
  fieldPath: string,
  value: any
): T {
  const keys = fieldPath.split(".");
  const lastKey = keys.pop();

  if (!lastKey) return obj;

  let current = { ...obj };
  let nested: any = current;

  for (const key of keys) {
    nested[key] = { ...(nested[key] || {}) };
    nested = nested[key];
  }

  nested[lastKey] = value;
  return current;
}