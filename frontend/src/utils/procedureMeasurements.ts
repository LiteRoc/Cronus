import type { TaskResult } from '@/types';

export function measurementUnit(task: TaskResult): string {
  const snapshot = task.measurementSnapshot;
  if (!snapshot) return task.unitOfMeasure || '';
  if (snapshot.unit === 'dimensionless') return '';
  return snapshot.unit === 'custom' ? snapshot.customUnitLabel || '' : snapshot.unit;
}

export function measurementContext(task: TaskResult): string {
  const s = task.measurementSnapshot;
  if (!s) return `${task.unitOfMeasure ? '' : 'Unit unknown. '}Bounds unknown (legacy).`;
  const bounds = s.minValue != null && s.maxValue != null
    ? `Range: ${s.minValue} to ${s.maxValue} (inclusive)`
    : s.minValue != null ? `Minimum: ${s.minValue} (inclusive)`
    : s.maxValue != null ? `Maximum: ${s.maxValue} (inclusive)` : 'No range limits';
  return `${s.unit === 'dimensionless' ? 'Dimensionless. ' : ''}${bounds}`;
}

export function measurementEvaluation(task: TaskResult, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not completed';
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Numeric reading required';
  const s = task.measurementSnapshot;
  const prefix = task.completed === true ? 'Completed — ' : 'Reading entered — ';
  if (!s) return `${prefix}range unknown`;
  if (s.minValue == null && s.maxValue == null) return `${prefix}not range-evaluated`;
  const passed = (s.minValue == null || value >= s.minValue) && (s.maxValue == null || value <= s.maxValue);
  return `${prefix}${passed ? 'Pass' : 'Fail (out of range)'}`;
}

export function measurementDisplay(task: TaskResult): string {
  if (task.value == null || task.value === '') return 'Pending';
  const reading = String(task.value), unit = measurementUnit(task);
  // Preserve legacy text and its explicit unit without parsing or rewriting it.
  const escapedUnit = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasUnit = new RegExp(`\\s${escapedUnit}\\s*$`).test(reading);
  return !unit || hasUnit ? reading : `${reading} ${unit}`;
}
