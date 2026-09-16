import { beforeEach, afterEach, expect, test } from 'vitest';
import type { AxiosAdapter } from 'axios';
import apiClient from './apiClient';
import { updateAsset } from './assetAPI';
const oldAdapter=apiClient.defaults.adapter;
let sent: Record<string,unknown>;
beforeEach(()=>{apiClient.defaults.adapter=(async config=>{sent=JSON.parse(config.data);return {data:{asset:sent},status:200,statusText:'OK',headers:{},config};}) satisfies AxiosAdapter;});
afterEach(()=>{apiClient.defaults.adapter=oldAdapter;});
test('whole fetched Asset is narrowed to ordinary editable fields',async()=>{
 await updateAsset('synthetic',{_id:'synthetic',facilityId:'protected',ctrlNumber:'A',manufacturer:'Synthetic',model:'Pump',description:'Changed',departmentId:'department',metrics:{totalMaintenanceCost:123},createdAt:'old',isArchived:true,benchmarkComparison:{capitalValue:1}});
 expect(sent).toEqual({ctrlNumber:'A',departmentId:'department',manufacturer:'Synthetic',model:'Pump',description:'Changed'});
});
test('populated shared Template is sent as a reference ID',async()=>{await updateAsset('synthetic',{templateId:{_id:'template',manufacturer:'Synthetic'}});expect(sent).toEqual({templateId:'template'});});
test('legitimate schedule edits preserve nested structure',async()=>{await updateAsset('synthetic',{maintenanceSchedule:{frequency:'Yearly',intervalMonths:12,lastMaintenance:'2026-01-01',procedure:'procedure'}});expect(sent.maintenanceSchedule).toEqual({frequency:'Yearly',intervalMonths:12,lastMaintenance:'2026-01-01',procedure:'procedure'});});
test('legitimate financial and compliance edits remain present',async()=>{await updateAsset('synthetic',{purchaseCost:25,budgetValue:30,contractValue:35,isHIPAARelevant:true,status:'Active'});expect(sent).toEqual({purchaseCost:25,budgetValue:30,contractValue:35,isHIPAARelevant:true,status:'Active'});});
test('Facility transfer is never sent, even as a partial update',async()=>{await updateAsset('synthetic',{facilityId:'other',description:'Legitimate'});expect(sent).toEqual({description:'Legitimate'});});
