import { expect, test, vi } from 'vitest';
vi.mock('./apiClient', () => ({ default: { patch: vi.fn().mockResolvedValue({ data: {} }) } }));
import client from './apiClient';
import { updateProcedureResults } from './workOrderAPI';

test('result client sends numeric readings, not client-owned snapshots, actor, or evaluation', async () => {
  vi.mocked(client.patch).mockResolvedValueOnce({ data: {} });
  await updateProcedureResults('wo', 'procedure', [{ taskId: 'task', label: 'Synthetic', type: 'measurement', value: 5,
    unitOfMeasure: 'kg', passed: false, completed: false, submittedBy: 'untrusted',
    measurementSnapshot: { version: 1, type: 'measurement', unit: 'kg', customUnitLabel: null, minValue: 100, maxValue: 200, required: true } }]);
  expect(client.patch).toHaveBeenCalledWith('/workorders/wo/procedure/procedure/task-results', {
    taskResults: [{ taskId: 'task', type: 'measurement', value: 5, comment: undefined }],
  });
});
