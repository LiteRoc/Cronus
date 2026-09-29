import { afterEach, beforeEach, expect, test } from 'vitest';
import type { AxiosAdapter } from 'axios';
import type { EquipmentTemplate } from '@/types';
import apiClient from './apiClient';
import { archiveTemplate, deleteTemplate, createTemplate, updateTemplate, createTempleteFromDI } from './templateAPI';
import { isTemplateArchived } from './templatePolicy';

const originalAdapter = apiClient.defaults.adapter;
let sent: { method?: string; url?: string; body: Record<string, unknown> };
beforeEach(() => {
  apiClient.defaults.adapter = (async config => {
    sent = { method: config.method, url: config.url, body: JSON.parse(config.data || '{}') };
    return { data: { template: { _id: 'template', ...sent.body } }, status: 200, statusText: 'OK', headers: {}, config };
  }) satisfies AxiosAdapter;
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; });

test('archive and legacy exported delete helper both use supported PATCH archive', async () => {
  for (const action of [archiveTemplate, deleteTemplate]) {
    await action('template');
    expect(sent).toEqual({ method: 'patch', url: '/templates/template/archive', body: {} });
  }
});
test('whole fetched Template narrows to business payload and preserves supported nested fields', async () => {
  await updateTemplate('template', {
    _id: 'template', status: 'Active', manufacturer: 'Synthetic', model: 'Pump', description: 'Changed',
    verified: true, verifiedAt: 'old', verifiedBy: 'other', verificationSource: 'Forged',
    createdAt: 'old', updatedAt: 'old', createdBy: 'other', updatedBy: 'other', deletedAt: null,
    deletedBy: null, archivedAt: null, archivedBy: null, isArchived: false, duplicateOf: 'other',
    benchmark: { confidence: 'high' }, lifecycleDefaults: { expectedLifeYears: 10 },
  });
  expect(sent.body).toEqual({ manufacturer: 'Synthetic', model: 'Pump', description: 'Changed', benchmark: { confidence: 'high' }, lifecycleDefaults: { expectedLifeYears: 10 } });
});
test('manual create never sends verification or provenance and returns the Template envelope', async () => {
  const result = await createTemplate({ manufacturer: 'Synthetic', model: 'Pump', description: 'Synthetic', equipmentClass: 'Class II', autoAddPmProcedure: false, verified: false, status: 'Active', createdBy: 'forged' });
  expect(sent.body).toEqual({ manufacturer: 'Synthetic', model: 'Pump', description: 'Synthetic', equipmentClass: 'Class II', autoAddPmProcedure: false });
  expect(result.template._id).toBe('template');
});
test('DI creation uses the repaired supported path', async () => {
  await createTempleteFromDI('00000000000001');
  expect(sent).toEqual({ method: 'post', url: '/templates/from-di', body: { di: '00000000000001' } });
});
for (const marker of [{ status: 'Archived' }, { deletedAt: 'old' }, { deletedBy: 'actor' }, { archivedAt: 'old' }, { archivedBy: 'actor' }, { isArchived: true }]) test(`UI recognizes archive marker ${Object.keys(marker)[0]}`, () => {
  expect(isTemplateArchived(marker as Partial<EquipmentTemplate>)).toBe(true);
});
test('legacy records without archive metadata remain active', () => {
  expect(isTemplateArchived({ status: 'Active', deletedAt: null })).toBe(false);
  expect(isTemplateArchived({})).toBe(false);
});

for (const field of ["deletedAt", "deletedBy", "archivedAt", "archivedBy", "isArchived", "status"]) {
  for (const value of [[null, "actor"], [null], [], {}, false, 1]) test(`malformed ${field}=${JSON.stringify(value)} is protected in the UI`, () => {
    expect(isTemplateArchived({ [field]: value } as unknown as Partial<EquipmentTemplate>)).toBe(true);
  });
}
test("exact null metadata remains active in the UI", () => {
  expect(isTemplateArchived({ deletedAt: null, deletedBy: null, archivedAt: null, archivedBy: null, isArchived: null } as unknown as Partial<EquipmentTemplate>)).toBe(false);
});
