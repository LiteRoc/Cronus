import { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import apiClient from './apiClient';
import { addTestEquipToWorkOrder, removeTestEquipFromWorkOrder, type EquipmentAcknowledgement } from './workOrderAPI';
import { useWorkOrderActions } from '@/pages/EditWorkOrder/hooks/useWorkOrderActions';

const originalAdapter = apiClient.defaults.adapter;
let calls: InternalAxiosRequestConfig[];
beforeEach(() => {
  calls = [];
  localStorage.setItem('token', 'synthetic-token');
  const adapter: AxiosAdapter = async config => {
    calls.push(config);
    return { data: { message: config.method === 'post' ? 'Test equipment added' : 'Test equipment removed' },
      status: 200, statusText: 'OK', headers: {}, config };
  };
  apiClient.defaults.adapter = adapter;
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; localStorage.clear(); });

test('equipment add accepts acknowledgement without a Work Order or Asset response', async () => {
  expect(await addTestEquipToWorkOrder('synthetic-wo','synthetic-asset')).toEqual({ message: 'Test equipment added' });
  expect(calls[0].url).toBe('/workorders/synthetic-wo/test-equipment');
  expect(JSON.parse(calls[0].data)).toEqual({ equipmentId: 'synthetic-asset' });
  expect(calls[0].headers.get('Authorization')).toBe('Bearer synthetic-token');
});
test('equipment remove accepts only the narrow acknowledgement', async () => {
  expect(await removeTestEquipFromWorkOrder('synthetic-wo','synthetic-asset')).toEqual({ message: 'Test equipment removed' });
  expect(calls[0].method).toBe('delete');
  expect(calls[0].url).toBe('/workorders/synthetic-wo/test-equipment/synthetic-asset');
});
test.each(['addTestEquip','deleteTestEquip'] as const)('%s updates local state then refetches without reading mutation response fields', async action => {
  const mutate = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useWorkOrderActions(mutate));
  const response = await result.current[action]('synthetic-wo','synthetic-asset');
  expect(Object.keys(response)).toEqual(['message']);
  expect(mutate).toHaveBeenCalledTimes(2);
  expect(mutate.mock.calls[0][0]).toBeTypeOf('function');
  expect(mutate.mock.calls[0][1]).toBe(false);
  expect(mutate.mock.calls[1]).toEqual([]);
});
test('equipment response types expose only the acknowledgement', () => {
  expectTypeOf<Awaited<ReturnType<typeof addTestEquipToWorkOrder>>>().toEqualTypeOf<EquipmentAcknowledgement>();
  expectTypeOf<Awaited<ReturnType<typeof removeTestEquipFromWorkOrder>>>().toEqualTypeOf<EquipmentAcknowledgement>();
  expectTypeOf<keyof EquipmentAcknowledgement>().toEqualTypeOf<'message'>();
});

test('Part removal uses the usage identity when the same catalog Part appears more than once', async () => {
  const { deletePartFromWorkOrder } = await import('./workOrderAPI');
  await deletePartFromWorkOrder('synthetic-wo', 'synthetic-part', 'synthetic-usage');
  expect(calls[0].url).toBe('/workorders/synthetic-wo/part-usages/synthetic-usage');
});
