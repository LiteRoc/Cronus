//src/hooks/useTestEquipment.ts

import useSWR from "swr";
import { useFacility } from "@/context/FacilityContext";
import { Asset, TestEquipmentOption } from "@/types";
import { createAsset, getTestEquip, updateAsset } from "@/services";
import { showSuccess, showError } from "@/utils/toastUtils";

export const useTestEquipment = () => {
    const { selectedFacilityId } = useFacility();
    const { data: testEquip, error, isLoading, mutate } = useSWR<TestEquipmentOption[]>(
        selectedFacilityId ? ["test-equipment", selectedFacilityId] : null,
        ([, facilityId]: [string, string]) => getTestEquip(facilityId),
        { keepPreviousData: false },
    );

    // Create
    const addTestEquip = async (payload: Partial<Asset>) => {
        try {
            await createAsset(payload);
            showSuccess('Test Equipment added successfully');
            mutate();
        } catch (err) {
            console.error("Error creating Test Equipment", err);
            showError("Failed to create Test Equipment");
        }
    };

    // Update
    const editTestEquip = async (id: string, payload: Partial<Asset>) => {
        try {
            await updateAsset(id, payload);
            showSuccess("Test Equipment updated successfully");
            mutate();
        } catch (err) {
            console.error("Error updating Test Equio", err);
            showError("Failed to update Test Equipment");
        }
    };

    return {
        testEquip: selectedFacilityId ? testEquip ?? [] : [],
        error,
        isLoading,
        mutate,
        editTestEquip,
        addTestEquip,
    }
};