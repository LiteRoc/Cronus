import { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from 'vitest';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import apiClient from './apiClient';
import { updateTimeLog } from './workOrderAPI';
import { useWorkOrderActions } from '@/pages/EditWorkOrder/hooks/useWorkOrderActions';
import TimeAndTravelLogs from '@/pages/EditWorkOrder/components/TimeAndTravelLogs';
import WorkOrderCostSummary from '@/pages/EditWorkOrder/components/WorkOrderCostSummary';
import type { WorkOrder, TimeLogCorrection } from '@/types';
const originalAdapter = apiClient.defaults.adapter;
const entry = {_id:'synthetic-log',timeSpent:60,description:'Original',workDate:'2026-12-31',userId:{_id:'synthetic-user',username:'Synthetic technician'},laborRate:100,laborCost:100};
const initial = {_id:'synthetic-wo',timeLogs:[entry],travelLogs:[],costs:{labor:100,total:100},economics:{revision:2}} as unknown as WorkOrder;
const corrected = {...initial,timeLogs:[{...entry,timeSpent:90,laborCost:150}],costs:{...initial.costs,labor:150,total:150},economics:{revision:3}} as unknown as WorkOrder;
let calls: InternalAxiosRequestConfig[];
beforeEach(() => {
  calls=[]; localStorage.setItem('token','synthetic-token');
  const adapter: AxiosAdapter = async config => {
    calls.push(config); return {data:{message:'Labor corrected',workOrder:corrected},status:200,statusText:'OK',headers:{},config};
  }; apiClient.defaults.adapter=adapter;
});
afterEach(() => {apiClient.defaults.adapter=originalAdapter;localStorage.clear();});
test('canonical PATCH returns server WorkOrder and forwards authentication', async () => {
  expect(await updateTimeLog(initial._id,entry._id,{timeSpent:90})).toEqual(corrected);
  expect(calls[0].url).toBe('/workorders/synthetic-wo/time-logs/synthetic-log');
  expect(calls[0].method).toBe('patch');expect(JSON.parse(calls[0].data)).toEqual({timeSpent:90});
  expect(calls[0].headers.get('Authorization')).toBe('Bearer synthetic-token');
});
test('payload permits only correction fields even if runtime caller supplies economics', async () => {
  const unsafe={timeSpent:90,description:'Corrected',workDate:'2027-01-01',laborRate:999,laborCost:999,pricing:{basis:'documented'},userId:'injected',costs:{total:999},arbitrary:1};
  await updateTimeLog(initial._id,entry._id,unsafe);
  expect(JSON.parse(calls[0].data)).toEqual({timeSpent:90,description:'Corrected',workDate:'2027-01-01'});
  expectTypeOf<keyof TimeLogCorrection>().toEqualTypeOf<'timeSpent'|'description'|'workDate'>();
});
test('hook waits for confirmation then installs snapshot, revision and costs together', async () => {
  let release!:()=>void;const pending=new Promise<void>(r=>{release=r;});
  apiClient.defaults.adapter=async config=>{await pending;return {data:{workOrder:corrected},status:200,statusText:'OK',headers:{},config};};
  const mutate=vi.fn().mockResolvedValue(undefined),{result}=renderHook(()=>useWorkOrderActions(mutate));
  const request=result.current.updateTimeLog(initial._id,entry._id,{timeSpent:90});
  expect(mutate).not.toHaveBeenCalled();release();await request;
  expect(mutate).toHaveBeenCalledTimes(1);
  const next=mutate.mock.calls[0][0](initial);
  expect(next.timeLogs).toEqual(corrected.timeLogs);expect(next.costs).toEqual(corrected.costs);expect(next.economics).toEqual(corrected.economics);
});
test('conflict propagates and leaves local economics unchanged', async () => {
  apiClient.defaults.adapter=async()=>{throw new Error('Work order economics changed; retry');};
  const mutate=vi.fn(),{result}=renderHook(()=>useWorkOrderActions(mutate));
  await expect(result.current.updateTimeLog(initial._id,entry._id,{timeSpent:90})).rejects.toThrow('changed');
  expect(mutate).not.toHaveBeenCalled();
});
test('editor saves drafted corrections by embedded identity without delete/re-add', async () => {
  const edit=vi.fn().mockResolvedValue(corrected),remove=vi.fn();
  render(<TimeAndTravelLogs workOrder={initial} userId="synthetic-user" onEditTimeLog={edit} onDeleteTimeLog={remove}/>);
  fireEvent.change(screen.getByLabelText('Labor minutes'),{target:{value:'90'}});
  fireEvent.change(screen.getByLabelText('Labor description'),{target:{value:'Corrected'}});
  fireEvent.change(screen.getByLabelText('Labor work date'),{target:{value:'2027-01-01'}});
  expect(edit).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Save'));
  await waitFor(()=>expect(edit).toHaveBeenCalledWith(initial._id,entry._id,{timeSpent:90,description:'Corrected',workDate:'2027-01-01'}));
  expect(remove).not.toHaveBeenCalled();expect(screen.queryByLabelText(/labor rate/i)).not.toBeInTheDocument();
});
test('description save omits economic inputs and unchanged save sends nothing', async () => {
  const edit=vi.fn().mockResolvedValue(corrected);
  render(<TimeAndTravelLogs workOrder={initial} userId="synthetic-user" onEditTimeLog={edit}/>);
  fireEvent.click(screen.getByText('Save'));expect(edit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Labor description'),{target:{value:'Metadata correction'}});
  fireEvent.click(screen.getByText('Save'));
  await waitFor(()=>expect(edit).toHaveBeenCalledWith(initial._id,entry._id,{description:'Metadata correction'}));
});
test('legacy minute save does not invent work date', async () => {
  const legacy={...initial,timeLogs:[{...entry,workDate:null,laborRate:null,laborCost:null}]} as unknown as WorkOrder;
  const edit=vi.fn().mockResolvedValue(legacy);
  render(<TimeAndTravelLogs workOrder={legacy} userId="synthetic-user" onEditTimeLog={edit}/>);
  expect(screen.getByLabelText('Labor work date')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Labor minutes'),{target:{value:'90'}});fireEvent.click(screen.getByText('Save'));
  await waitFor(()=>expect(edit).toHaveBeenCalledWith(initial._id,entry._id,{timeSpent:90}));
});
test('gap response installs unknown economics rendered by existing summary', async () => {
  const incomplete={knownSubtotal:0,total:null,isComplete:false,missingComponents:[{component:'internalLabor',reason:'no_applicable_rate'}]};
  const gap={...initial,timeLogs:[{...entry,workDate:'2026-09-30',laborRate:null,laborCost:null}],costs:{labor:null,parts:0,total:null,scopes:{internal:incomplete,vendorDirect:{...incomplete,total:0,isComplete:true,missingComponents:[]},directMaintenance:incomplete}},economics:{revision:3}} as unknown as WorkOrder;
  apiClient.defaults.adapter=async config=>({data:{workOrder:gap},status:200,statusText:'OK',headers:{},config});
  const mutate=vi.fn(),{result}=renderHook(()=>useWorkOrderActions(mutate));
  await result.current.updateTimeLog(initial._id,entry._id,{workDate:'2026-09-30'});
  const next=mutate.mock.calls[0][0](initial);render(<WorkOrderCostSummary costs={next.costs}/>);
  expect(next.timeLogs[0].laborRate).toBeNull();expect(next.costs.labor).toBeNull();
  expect(screen.getAllByText(/Incomplete — known subtotal \$0.00/)).toHaveLength(2);
});
