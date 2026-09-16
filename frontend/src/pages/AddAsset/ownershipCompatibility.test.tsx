import { act, fireEvent, render, screen, waitFor, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Asset } from '@/types';
import AssetModal from './modals/CreateAssetModal';
import UdiModal from './modals/CreateAssetFromUdiModal';
import ListWorkOrderModal from '../ListWorkOrders/modals/CreateWorkOrderModal';
import AssetWorkOrderModal from '../EditAsset/modals/CreateWorkOrderModal';
import { useFacilityDepartmentData } from '@/hooks/useFacilityDepartmentData';
const context=vi.hoisted(()=>({selectedFacilityId:'A'}));
const api=vi.hoisted(()=>({getTemplates:vi.fn(),getDepartmentsByFacility:vi.fn(),addAsset:vi.fn(),createAssetFromUDI:vi.fn()}));
vi.mock('@/services',()=>api);
vi.mock('@/services/departmentAPI',()=>({getDepartmentsByFacility:api.getDepartmentsByFacility}));
vi.mock('@/context/FacilityContext',()=>({useFacility:()=>({...context,availableFacilities:[]})}));
beforeEach(()=>{vi.clearAllMocks();context.selectedFacilityId='A';api.getTemplates.mockResolvedValue({templates:[]});api.getDepartmentsByFacility.mockResolvedValue([{_id:'department-a',name:'Department A'}]);});
for(const [label,Component] of [['ordinary',AssetModal],['UDI',UdiModal]] as const){
 test(`${label} clears selected Department when Facility changes`,async()=>{
  const element=()=> <MemoryRouter><Component isOpen onClose={()=>{}} onCreated={()=>{}} /></MemoryRouter>;
  const view=render(element());const option=await screen.findByRole('option',{name:'Department A'});const select=option.closest('select')!;
  fireEvent.change(select,{target:{value:'department-a'}});expect(select.value).toBe('department-a');
  context.selectedFacilityId='B';api.getDepartmentsByFacility.mockResolvedValue([{_id:'department-b',name:'Department B'}]);view.rerender(element());
  await screen.findByRole('option',{name:'Department B'});expect(select.value).toBe('');expect(screen.queryByRole('option',{name:'Department A'})).toBeNull();
 });
 test(`${label} ignores a stale Department response after Facility changes`,async()=>{
  let resolve!:(rows:unknown[])=>void;api.getDepartmentsByFacility.mockReturnValueOnce(new Promise(done=>{resolve=done;}));
  const element=()=> <MemoryRouter><Component isOpen onClose={()=>{}} onCreated={()=>{}} /></MemoryRouter>;
  const view=render(element());context.selectedFacilityId='B';api.getDepartmentsByFacility.mockResolvedValue([{_id:'b',name:'Department B'}]);view.rerender(element());
  await screen.findByRole('option',{name:'Department B'});await act(async()=>resolve([{_id:'a',name:'Stale Department'}]));expect(screen.queryByRole('option',{name:'Stale Department'})).toBeNull();
 });
}
for(const [name,Component] of [['list',ListWorkOrderModal],['asset',AssetWorkOrderModal]] as const)test(`${name} Work Order modal leaves default assignment to the server`,async()=>{
 const create=vi.fn().mockResolvedValue(undefined);render(<Component asset={{_id:'asset-a'} as Asset} onClose={()=>{}} onCreate={create}/>);
 fireEvent.click(screen.getByRole('button',{name:'Create'}));await waitFor(()=>expect(create).toHaveBeenCalled());expect(create.mock.calls[0][0]).not.toHaveProperty('assignedTo');
});
test('edit Department cache is keyed by selected Facility',async()=>{
 const cache=new Map();const wrapper=({children}:{children:React.ReactNode})=><SWRConfig value={{provider:()=>cache}}>{children}</SWRConfig>;
 const view=renderHook(()=>useFacilityDepartmentData(),{wrapper});await waitFor(()=>expect(view.result.current.departments[0]?.name).toBe('Department A'));
 context.selectedFacilityId='B';api.getDepartmentsByFacility.mockResolvedValue([{_id:'b',name:'Department B'}]);view.rerender();await waitFor(()=>expect(view.result.current.departments[0]?.name).toBe('Department B'));
});
