//src/hooks/useVendors.ts

import useSWR from "swr";
import { getVendorById, getVendors } from "@/services/vendorAPI";
import { Vendor } from "@/types/Vendor";

export const useVendors = () => {
    const { data: vendors, error, isLoading, mutate } = useSWR<Vendor[]>("vendors", getVendors,
        { revalidateOnMount: true, revalidateIfStale: true, revalidateOnFocus: true }
    );
    //console.log("Vendors returned from Backend:", vendors?.length);

    return { vendors, error, isLoading, mutate };
};

export const useVendorById = (vendorId?: string | null) => {
    const shouldFetch = !!vendorId;

    const { data: vendor, error, isLoading, mutate } = useSWR<Vendor>(
        shouldFetch ? `vendor/${vendorId}` : null,
        () => getVendorById(vendorId!)
    );

    return { vendor, error, isLoading, mutate };
};