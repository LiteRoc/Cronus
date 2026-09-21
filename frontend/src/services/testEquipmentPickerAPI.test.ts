import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useTestEquipment } from '@/pages/EditWorkOrder/hooks/useTestEquipment';
import { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from 'vitest';
import apiClient from './apiClient';
import { getTestEquip } from './assetAPI';
import type { TestEquipmentOption } from '@/types';

const context=vi.hoisted(()=>({selectedFacilityId:'A' as string|null}));
vi.mock('@/context/FacilityContext',()=>({useFacility:()=>context}));
const originalAdapter=apiClient.defaults.adapter;
let calls: InternalAxiosRequestConfig[];
const option: TestEquipmentOption={_id:'synthetic-id',ctrlNumber:'SYN-A',manufacturer:'Synthetic maker',model:'Synthetic model'};
beforeEach(()=>{
  context.selectedFacilityId='A';calls=[];localStorage.setItem('token','synthetic-token');localStorage.setItem('selectedFacilityId','stale-B');
  const adapter: AxiosAdapter=async config=>{calls.push(config);return {data:[option],status:200,statusText:'OK',headers:{},config};};
  apiClient.defaults.adapter=adapter;
});
afterEach(()=>{apiClient.defaults.adapter=originalAdapter;localStorage.clear();});
test('picker preserves explicit selected Facility despite stale browser storage',async()=>{
  expect(await getTestEquip('A')).toEqual([option]);expect(calls[0].url).toBe('/assets/test-equipment');
  expect(calls[0].headers.get('x-facility-id')).toBe('A');expect(calls[0].headers.get('Authorization')).toBe('Bearer synthetic-token');
});
test('picker refuses empty Facility without falling back to localStorage',async()=>{
  await expect(getTestEquip('')).rejects.toThrow('Select a Facility');expect(calls).toHaveLength(0);
});
test('independent requests carry their own selected context',async()=>{
  await Promise.all([getTestEquip('A'),getTestEquip('B')]);
  expect(calls.map(c=>c.headers.get('x-facility-id'))).toEqual(['A','B']);
});
test('picker contract exposes only identity and display fields',()=>{
  expectTypeOf<Awaited<ReturnType<typeof getTestEquip>>>().toEqualTypeOf<TestEquipmentOption[]>();
  expectTypeOf<keyof TestEquipmentOption>().toEqualTypeOf<'_id'|'ctrlNumber'|'manufacturer'|'model'>();
});

test('active hook sends current Facility through the real client/interceptor on selection changes',async()=>{
  const cache=new Map();
  const wrapper=({children}:{children:ReactNode})=>createElement(SWRConfig,{value:{provider:()=>cache,dedupingInterval:0,shouldRetryOnError:false}},children);
  const {result,rerender}=renderHook(()=>useTestEquipment(),{wrapper});
  await waitFor(()=>expect(result.current.testEquip).toEqual([option]));
  expect(calls[0].headers.get('x-facility-id')).toBe('A');
  localStorage.setItem('selectedFacilityId','stale-A');context.selectedFacilityId='B';rerender();
  await waitFor(()=>expect(calls).toHaveLength(2));
  expect(calls[1].headers.get('x-facility-id')).toBe('B');
  await waitFor(()=>expect(result.current.testEquip).toEqual([option]));
  context.selectedFacilityId=null;rerender();expect(result.current.testEquip).toEqual([]);expect(calls).toHaveLength(2);
});
