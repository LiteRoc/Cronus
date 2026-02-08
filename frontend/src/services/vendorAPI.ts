import { Vendor } from "@/types/Vendor";
import apiClient from "./apiClient";

export const getVendors = async () => {
    const { data } = await apiClient.get<Vendor[]>('/vendors');
    return data;
};

export const getVendorById = async (vendorId: string) => {
    const { data } = await apiClient.get<Vendor>(`/vendors/${vendorId}`);
    return data;
};

export const createVendor = async (payload: Partial<Vendor>) => {
    const { data } = await apiClient.post<Vendor>('/vendor', payload);
    return data;
};

export const updateVendor = async (vendorId: string, payload: Partial<Vendor>) => {
    const { data } = await apiClient.put<Vendor>(`/vendors/${vendorId}`, payload);
    return data;
};

export const deleteVendor = async (vendorId: string) => {
    const { data } = await apiClient.delete(`/vendors/${vendorId}`);
    return data;
};