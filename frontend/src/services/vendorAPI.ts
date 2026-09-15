import type { Vendor, VendorUpdate } from "@/types/Vendor";
import apiClient from "./apiClient";

export const getVendors = async () => {
    const { data } = await apiClient.get<Vendor[]>('/vendors');
    return data;
};

export const getVendorById = async (vendorId: string) => {
    const { data } = await apiClient.get<Vendor>(`/vendors/${vendorId}`);
    return data;
};

// Creation is disabled: the server returns 409 for admins and auth/role errors otherwise.
// Keep the helper for callers to receive the authoritative policy error.
export const createVendor = async (payload: VendorUpdate) => {
    const { data } = await apiClient.post<never>('/vendors', payload);
    return data;
};

export const updateVendor = async (vendorId: string, payload: VendorUpdate) => {
    const { data } = await apiClient.put<{ message: string; vendor: Vendor }>(`/vendors/${vendorId}`, payload);
    return data.vendor;
};

// DELETE archives in place; it never physically deletes the Vendor.
// Repeating an archive receives the server's stable 404 response.
export const deleteVendor = async (vendorId: string) => {
    const { data } = await apiClient.delete<{ message: string }>(`/vendors/${vendorId}`);
    return data;
};
