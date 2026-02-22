import useSWR from "swr";
import type { Asset } from "@/types";
import { getAssetById, getAssetLifecycle, updateAsset } from "@/services";
import { showError, showSuccess } from "@/utils/toastUtils";
import { updateNestedField } from "@/utils/updateNestedField";
import { useState } from "react";

export const useAssetForm = (assetId: string) => {
  const [isSaving, setIsSaving] = useState(false);
  const { data: asset, error, isLoading, mutate } = useSWR(
    assetId ? ['asset', assetId] : null,
    ([, id]) => getAssetById(id)
  );
  const {
    data: lifecycle,
    error: lifecycleError,
    isLoading: isLifecycleLoading,
    mutate: mutateLifecycle,
  } = useSWR(
    assetId ? ["asset-lifecycle", assetId] : null,
    ([, id]) => getAssetLifecycle(id)
  );

  const handleChange = (field: keyof Asset, value: any) => {
    if (!asset) return;
    mutate({ ...asset, [field]: value }, false);
  };

  const updateField = (fieldPath: string, value: any) => {
    if (!asset) return;
    const updated = updateNestedField(asset, fieldPath, value);
    mutate(updated, false);
  };

  /** Save asset back to the server */
  const saveAsset = async (): Promise<boolean> => {
    if (!asset) return false;
    setIsSaving(true);
    try {
      await updateAsset(asset._id, asset);
      await Promise.all([mutate(), mutateLifecycle()]); // revalidate from server
      showSuccess("Asset updated successfully!");
      return true;
    } catch (err) {
      console.error("Error saving asset:", err);
      showError("Failed to save asset.");
      return false;
    }
  };

  return {
    asset,
    isLoading,
    isSaving,
    isError: !!error,
    error,
    lifecycle,
    lifecycleError,
    isLifecycleLoading,
    handleChange,
    updateField,
    saveAsset,
  };
};
