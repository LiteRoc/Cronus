import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, expect, expectTypeOf, test } from 'vitest';
import apiClient from './apiClient';
import { createVendor, deleteVendor, getVendorById, getVendors, updateVendor } from './vendorAPI';
import type { Vendor, VendorUpdate } from '@/types/Vendor';

const vendor: Vendor = { _id: 'synthetic-vendor', name: 'Synthetic', contactName: 'Desk', email: 'desk@example.invalid' };
const originalAdapter = apiClient.defaults.adapter;
let calls: InternalAxiosRequestConfig[];
beforeEach(() => {
  calls = [];
  localStorage.setItem('token', 'synthetic-token');
  const adapter: AxiosAdapter = async config => {
    calls.push(config);
    if (config.method === 'post') {
      const response = { data: { error: 'Vendor creation is unavailable pending Vendor ownership normalization' }, status: 409, statusText: 'Conflict', headers: {}, config };
      throw new AxiosError('Request failed with status code 409', 'ERR_BAD_REQUEST', config, undefined, response);
    }
    const data = config.method === 'put' ? { message: 'Vendor updated', vendor: { ...vendor, email: 'changed@example.invalid' } }
      : config.method === 'delete' ? { message: 'Vendor archived' }
        : config.url === '/vendors' ? [vendor] : vendor;
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  apiClient.defaults.adapter = adapter;
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; localStorage.clear(); });

test('flat list/detail projections preserve picker and contact fields without invented nested data', async () => {
  expect(await getVendors()).toEqual([vendor]);
  expect(await getVendorById(vendor._id)).toEqual(vendor);
  expect(vendor).not.toHaveProperty('contactInfo');
  expect(vendor).not.toHaveProperty('notes');
  expect(calls.every(c => c.headers.get('Authorization') === 'Bearer synthetic-token')).toBe(true);
});
test('admin update sends flat mutable fields and unwraps the returned Vendor', async () => {
  const result = await updateVendor(vendor._id, { email: 'changed@example.invalid' });
  expect(result).toEqual({ ...vendor, email: 'changed@example.invalid' });
  expect(JSON.parse(calls[0].data)).toEqual({ email: 'changed@example.invalid' });
  expect(calls[0].url).toBe(`/vendors/${vendor._id}`);
});
test('disabled create uses plural endpoint and preserves the explanatory 409 error', async () => {
  await expect(createVendor({ name: 'Synthetic' })).rejects.toMatchObject({ response: { status: 409,
    data: { error: 'Vendor creation is unavailable pending Vendor ownership normalization' } } });
  expect(calls[0].url).toBe('/vendors');
});
test('legacy delete helper represents soft archival, without claiming physical deletion', async () => {
  expect(await deleteVendor(vendor._id)).toEqual({ message: 'Vendor archived' });
  expect(calls[0].method).toBe('delete');
});
test('type contract excludes legacy contact shape and protected mutable fields', () => {
  expectTypeOf<Extract<keyof Vendor, 'contactInfo' | 'tenantId'>>().toEqualTypeOf<never>();
  expectTypeOf<Extract<keyof VendorUpdate, '_id' | 'tenantId' | 'archivedAt' | 'archivedBy' | 'createdAt'>>().toEqualTypeOf<never>();
  expectTypeOf<Vendor['notes']>().toEqualTypeOf<string | undefined>();
});
