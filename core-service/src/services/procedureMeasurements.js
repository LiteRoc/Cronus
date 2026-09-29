// Unit codes are exact labels, not conversion rules. Unknown historic labels
// must be reviewed explicitly as custom units before a new attachment.
const UNITS = Object.freeze([
  'dimensionless', 'custom', '%', 'V', 'mV', 'A', 'mA', 'µA', 'Ω', 'kΩ', 'MΩ',
  'W', 'mW', 'J', 'Hz', 'kHz', 'MHz', 's', 'ms', 'min', '°C', '°F', 'K',
  'Pa', 'kPa', 'bar', 'mbar', 'mmHg', 'cmH2O', 'psi', 'L', 'mL', 'L/min',
  'mL/min', 'mL/h', 'kg', 'g', 'mg', 'm', 'cm', 'mm', 'bpm', 'rpm', 'dB',
]);
const fail = message => { const error = new Error(message); error.status = 400; throw error; };
const finite = value => typeof value === 'number' && Number.isFinite(value);

function snapshot(task) {
  if (task.type !== 'measurement') return undefined;
  if (!UNITS.includes(task.unit)) fail('Measurement unit must be selected explicitly from the unit vocabulary');
  if (task.unit === 'custom' && (typeof task.customUnitLabel !== 'string' ||
      !task.customUnitLabel.trim() || task.customUnitLabel.length > 100)) {
    fail('A custom measurement unit requires a label of 1–100 characters');
  }
  if (task.unit !== 'custom' && task.customUnitLabel != null && task.customUnitLabel !== '') {
    fail('Custom unit label is only valid for a custom unit');
  }
  for (const key of ['minValue', 'maxValue']) {
    if (task[key] != null && !finite(task[key])) fail('Measurement bounds must be finite numbers');
  }
  if (task.minValue != null && task.maxValue != null && task.minValue > task.maxValue) {
    fail('Measurement lower bound must not exceed upper bound');
  }
  if (task.requiredMeasurement != null && typeof task.requiredMeasurement !== 'boolean') {
    fail('requiredMeasurement must be a boolean');
  }
  return {
    version: 1, type: 'measurement', unit: task.unit,
    customUnitLabel: task.unit === 'custom' ? task.customUnitLabel : null,
    minValue: task.minValue ?? null, maxValue: task.maxValue ?? null,
    required: task.requiredMeasurement !== false,
  };
}

function unitLabel(captured) {
  if (!captured || captured.unit === 'dimensionless') return null;
  return captured.unit === 'custom' ? captured.customUnitLabel : captured.unit;
}

function evaluate(value, captured) {
  if (!finite(value)) fail('Measurement reading must be a finite number');
  // Absence of a snapshot is unknown, not an unbounded measurement.
  if (!captured || captured.version !== 1) return null;
  if (captured.minValue == null && captured.maxValue == null) return null;
  return (captured.minValue == null || value >= captured.minValue) &&
    (captured.maxValue == null || value <= captured.maxValue);
}

function attachment(task) {
  const captured = snapshot(task);
  return {
    taskId: task._id, label: task.description, type: task.type,
    ...(captured ? { measurementSnapshot: captured } : {}),
    unitOfMeasure: unitLabel(captured), value: null, passed: null,
    completed: false, resultVersion: 1, comment: '',
  };
}

function submit(existing, incoming, actor, now) {
  if (incoming.type != null && incoming.type !== existing.type) fail('Task type cannot change on submission');
  if (!Object.prototype.hasOwnProperty.call(incoming, 'value')) fail('Task reading is required');
  const value = incoming.value;
  let passed = null;
  let completed = value != null && value !== '';
  if (existing.type === 'measurement') {
    if (value == null && existing.measurementSnapshot?.required === false) completed = false;
    else { passed = evaluate(value, existing.measurementSnapshot); completed = true; }
  } else if (existing.type === 'pass/fail') {
    if (value !== null && typeof value !== 'boolean') fail('Pass/fail reading must be a boolean');
    passed = value;
  } else if (existing.type === 'comment') {
    if (typeof value !== 'string') fail('Comment reading must be text');
  } else fail('Unsupported attached task type');
  // Everything except the reading and comment is taken from the attachment or
  // the authenticated request. Older clients cannot replace snapshot metadata.
  return {
    ...existing, value, passed, completed, resultVersion: 1,
    ...(existing.measurementSnapshot ? { unitOfMeasure: unitLabel(existing.measurementSnapshot) } : {}),
    comment: typeof incoming.comment === 'string' ? incoming.comment : (existing.comment || ''),
    submittedBy: actor, submittedAt: now,
  };
}

function assertComplete(procedures) {
  for (const procedure of procedures || []) {
    for (const result of procedure.taskResults || []) {
      if (result.type === 'measurement' && result.measurementSnapshot?.required !== false && !finite(result.value)) {
        fail('Required measurements need numeric readings before work can be completed');
      }
    }
  }
}

module.exports = { UNITS, finite, snapshot, unitLabel, evaluate, attachment, submit, assertComplete };
