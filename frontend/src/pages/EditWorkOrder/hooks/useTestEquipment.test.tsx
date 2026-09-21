import { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { SWRConfig } from 'swr';
import { useTestEquipment } from './useTestEquipment';

const context=vi.hoisted(()=>({selectedFacilityId:'A' as string|null}));
const api=vi.hoisted(()=>({getTestEquip:vi.fn(),createAsset:vi.fn(),updateAsset:vi.fn()}));
vi.mock('@/context/FacilityContext',()=>({useFacility:()=>context}));
vi.mock('@/services',()=>api);
const row=(facility:string)=>({_id:facility,ctrlNumber:'SYN-'+facility,manufacturer:'Synthetic',model:'Meter'});
const wrapperForTest=()=>{const cache=new Map();return function Wrapper({children}:{children:ReactNode}){return <SWRConfig value={{provider:()=>cache,dedupingInterval:0,shouldRetryOnError:false}}>{children}</SWRConfig>;};};
beforeEach(()=>{vi.clearAllMocks();context.selectedFacilityId='A';api.getTestEquip.mockImplementation(async id=>[row(id)]);});
test('loads the minimal options for explicit selected Facility',async()=>{
  const {result}=renderHook(()=>useTestEquipment(),{wrapper:wrapperForTest()});
  await waitFor(()=>expect(result.current.testEquip).toEqual([row('A')]));expect(api.getTestEquip).toHaveBeenCalledWith('A');
});
test('missing Facility neither fetches nor displays options',async()=>{
  context.selectedFacilityId=null;const {result}=renderHook(()=>useTestEquipment(),{wrapper:wrapperForTest()});
  expect(result.current.testEquip).toEqual([]);expect(api.getTestEquip).not.toHaveBeenCalled();
});
test('switching Facility clears prior options while new request is pending',async()=>{
  let resolveB!:(value:ReturnType<typeof row>[])=>void;
  api.getTestEquip.mockImplementation(id=>id==='A'?Promise.resolve([row('A')]):new Promise(resolve=>{resolveB=resolve;}));
  const {result,rerender}=renderHook(()=>useTestEquipment(),{wrapper:wrapperForTest()});
  await waitFor(()=>expect(result.current.testEquip).toEqual([row('A')]));
  context.selectedFacilityId='B';rerender();expect(result.current.testEquip).toEqual([]);
  await act(async()=>{resolveB([row('B')]);});await waitFor(()=>expect(result.current.testEquip).toEqual([row('B')]));
  context.selectedFacilityId=null;rerender();expect(result.current.testEquip).toEqual([]);
});
test('late previous-Facility response cannot replace current picker data',async()=>{
  let resolveA!:(value:ReturnType<typeof row>[])=>void;
  api.getTestEquip.mockImplementation(id=>id==='A'?new Promise(resolve=>{resolveA=resolve;}):Promise.resolve([row('B')]));
  const {result,rerender}=renderHook(()=>useTestEquipment(),{wrapper:wrapperForTest()});
  await waitFor(()=>expect(api.getTestEquip).toHaveBeenCalledWith('A'));
  context.selectedFacilityId='B';rerender();await waitFor(()=>expect(result.current.testEquip).toEqual([row('B')]));
  await act(async()=>{resolveA([row('A')]);});expect(result.current.testEquip).toEqual([row('B')]);
});
test('late previous-Facility failure cannot populate current picker error state',async()=>{
  let rejectA!:(reason:Error)=>void;
  api.getTestEquip.mockImplementation(id=>id==='A'?new Promise((_resolve,reject)=>{rejectA=reject;}):Promise.resolve([row('B')]));
  const {result,rerender}=renderHook(()=>useTestEquipment(),{wrapper:wrapperForTest()});
  await waitFor(()=>expect(api.getTestEquip).toHaveBeenCalledWith('A'));
  context.selectedFacilityId='B';rerender();await waitFor(()=>expect(result.current.testEquip).toEqual([row('B')]));
  await act(async()=>{rejectA(new Error('Synthetic previous-Facility failure'));});
  expect(result.current.testEquip).toEqual([row('B')]);expect(result.current.error).toBeUndefined();
});
