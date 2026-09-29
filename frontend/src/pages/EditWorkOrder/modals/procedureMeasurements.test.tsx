import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
import type { TaskResult } from '@/types';
import Perform from './PerformProcedureModal';
import View from './ViewTaskResutsModal';
import { measurementDisplay, measurementEvaluation } from '@/utils/procedureMeasurements';

const makeTask = (overrides: Partial<TaskResult> = {}): TaskResult => ({
  taskId: 'synthetic-task', type: 'measurement', label: 'Synthetic voltage', value: null, unitOfMeasure: 'V',
  measurementSnapshot: { version: 1, type: 'measurement', unit: 'V', customUnitLabel: null, minValue: 0, maxValue: 10, required: true },
  ...overrides,
});
function perform(task = makeTask()) {
  const submit = vi.fn().mockResolvedValue(undefined), close = vi.fn();
  const rendered = render(<Perform procedure={{ _id: 'synthetic-procedure', name: 'Synthetic', taskResults: [task] }}
    onSubmitResults={submit} onClose={close} userId="synthetic" userName="Synthetic" />);
  return { ...rendered, submit, close };
}
const input = () => screen.getByRole('spinbutton', { name: 'Synthetic voltage' });

test('entry shows unit once and inclusive bounds, retains value, and has no native range rejection', () => {
  perform(makeTask({ value: 5 }));
  expect(input()).toHaveValue(5); expect(input()).toHaveAttribute('step', 'any'); expect(input()).toBeRequired();
  expect(input()).not.toHaveAttribute('min'); expect(input()).not.toHaveAttribute('max');
  expect(screen.getAllByText('V')).toHaveLength(1);
  expect(screen.getByText('Range: 0 to 10 (inclusive)')).toBeInTheDocument();
});
test('out-of-range input is accepted, visibly failed, submitted as a number, and does not carry authority fields', async () => {
  const { submit, close } = perform(); fireEvent.change(input(), { target: { value: '11' } });
  expect(screen.getByRole('status')).toHaveTextContent('Reading entered — Fail (out of range)');
  fireEvent.click(screen.getByText('Submit Results'));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0][0]).toEqual([{ taskId: 'synthetic-task', type: 'measurement', label: 'Synthetic voltage', value: 11 }]);
  expect(close).toHaveBeenCalledTimes(1);
});
test.each(['', 'nonsense', 'Infinity'])('invalid or empty required input %p cannot complete', value => {
  const { submit } = perform(); fireEvent.change(input(), { target: { value } });
  fireEvent.click(screen.getByText('Submit Results')); expect(submit).not.toHaveBeenCalled();
  // The handler also rejects absence when submission bypasses browser validity.
  fireEvent.submit(input().closest('form')!); expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('numeric reading is required');
});
test.each([0, 10])('exact boundary %p passes and zero is not missing', async value => {
  const { submit } = perform(); fireEvent.change(input(), { target: { value: String(value) } });
  expect(screen.getByRole('status')).toHaveTextContent('Reading entered — Pass');
  fireEvent.click(screen.getByText('Submit Results')); await waitFor(() => expect(submit).toHaveBeenCalled());
  expect(submit.mock.calls[0][0][0].value).toBe(value);
});
test('dimensionless entry/result is explicit without a suffix', () => {
  const task = makeTask({ value: 5, unitOfMeasure: null, measurementSnapshot: { ...makeTask().measurementSnapshot!, unit: 'dimensionless' } });
  const view = perform(task);
  expect(screen.getByText('Dimensionless. Range: 0 to 10 (inclusive)')).toBeInTheDocument();
  expect(screen.queryByText('V')).not.toBeInTheDocument();
  view.unmount(); render(<View taskResults={[task]} onClose={() => {}} />);
  expect(screen.getByText('5')).toBeInTheDocument(); expect(screen.queryByText('5 dimensionless')).not.toBeInTheDocument();
});
test('custom unit is shown once in input and once in result', () => {
  const task = makeTask({ value: 5, unitOfMeasure: 'cycles/test', measurementSnapshot: { ...makeTask().measurementSnapshot!, unit: 'custom', customUnitLabel: 'cycles/test' } });
  const view = perform(task); expect(screen.getAllByText('cycles/test')).toHaveLength(1);
  view.unmount(); render(<View taskResults={[task]} onClose={() => {}} />);
  expect(screen.getAllByText('5 cycles/test')).toHaveLength(1); expect(screen.queryByText('custom')).not.toBeInTheDocument();
});
test.each([[0, null, 'Minimum: 0 (inclusive)'], [null, 10, 'Maximum: 10 (inclusive)'], [null, null, 'No range limits']])(
  'one-sided/unbounded criteria %p %p display correctly', (min, max, text) => {
    perform(makeTask({ value: 5, measurementSnapshot: { ...makeTask().measurementSnapshot!, minValue: min as number | null, maxValue: max as number | null } }));
    expect(screen.getByText(String(text))).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(min == null && max == null ? 'not range-evaluated' : 'Pass');
  });
test('legacy missing unit/bounds stay unknown; historical text is retained visibly without inference', () => {
  const task = makeTask({ value: '5 volts', unitOfMeasure: null, measurementSnapshot: undefined });
  perform(task); expect(input()).toHaveValue(null);
  expect(screen.getByText('Unit unknown. Bounds unknown (legacy).')).toBeInTheDocument();
  expect(screen.getByText('Previous reading: 5 volts. Enter a numeric reading to replace it.')).toBeInTheDocument();
  expect(measurementDisplay(task)).toBe('5 volts'); expect(measurementEvaluation(task, 5)).toContain('range unknown');
});
test('legacy value already carrying an explicit unit displays that unit once without rewriting value', () => {
  const task = makeTask({ value: '5 V', measurementSnapshot: undefined });
  render(<View taskResults={[task]} onClose={() => {}} />);
  expect(screen.getByText('5 V')).toBeInTheDocument(); expect(screen.queryByText('5 V V')).not.toBeInTheDocument();
  expect(task.value).toBe('5 V');
});
test('result display distinguishes failure from completion', () => {
  render(<View taskResults={[makeTask({ value: 11, passed: false, completed: true })]} onClose={() => {}} />);
  expect(screen.getByText('11 V')).toBeInTheDocument(); expect(screen.getByText('Completed — Fail (out of range)')).toBeInTheDocument();
});
test('optional measurement can be submitted unanswered without implying pass/completion', async () => {
  const { submit } = perform(makeTask({ measurementSnapshot: { ...makeTask().measurementSnapshot!, required: false } }));
  expect(input()).not.toBeRequired(); expect(screen.getByRole('status')).toHaveTextContent('Not completed');
  fireEvent.click(screen.getByText('Submit Results')); await waitFor(() => expect(submit).toHaveBeenCalled());
  expect(submit.mock.calls[0][0][0].value).toBeNull();
});
test('server rejection retains entered reading and keeps modal open', async () => {
  const { submit, close } = perform(makeTask({ value: 5 })); submit.mockRejectedValueOnce(new Error('synthetic conflict'));
  fireEvent.click(screen.getByText('Submit Results')); await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(input()).toHaveValue(5); expect(close).not.toHaveBeenCalled();
});


test.each(['5 V', '5 V ', '5\tV', '5\nV\n', '5\u00a0V\u00a0', '5 V\r\n\t'])('unit suffix recognition preserves historical whitespace in %p', value => {
  const task = makeTask({ value, measurementSnapshot: undefined });
  expect(measurementDisplay(task)).toBe(value);
  render(<View taskResults={[task]} onClose={() => {}} />);
  expect(screen.getByText('5 V')).toBeInTheDocument();
  expect(task.value).toBe(value);
});
test.each(['5', '5V', '5 V extra', 'V 5', '5 mV'])('unit suffix recognition appends missing unit without false positives for %p', value => {
  expect(measurementDisplay(makeTask({ value, measurementSnapshot: undefined }))).toBe(`${value} V`);
});
test.each(['cycles/test', '  custom units  ', 'units (x)+[y].*'])('unit suffix recognition preserves exact custom label %p', label => {
  const snapshot = { ...makeTask().measurementSnapshot!, unit: 'custom', customUnitLabel: label };
  const value = `5\t${label}\n`;
  const task = makeTask({ value, measurementSnapshot: snapshot });
  expect(measurementDisplay(task)).toBe(value);
  expect(measurementDisplay({ ...task, value: 5 })).toBe(`5 ${label}`);
  expect(task.measurementSnapshot?.customUnitLabel).toBe(label); expect(task.value).toBe(value);
});
test('unit suffix recognition leaves dimensionless values suffix-free', () => {
  const task = makeTask({ value: '5 ', measurementSnapshot: { ...makeTask().measurementSnapshot!, unit: 'dimensionless' } });
  expect(measurementDisplay(task)).toBe('5 ');
});
