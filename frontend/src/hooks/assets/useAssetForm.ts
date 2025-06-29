import { useEffect, useState } from "react";
import { Asset } from "../../types/types";
import { getAssetById, updateAsset } from "../../services/assetAPI";
import { showError, showSuccess } from "../../utils/toastUtils";
import { updateNestedField } from "../../utils/updateNestedField";

export const useAssetForm = (assetId: string) => {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const data = await getAssetById(assetId);
        setAsset(data);
      } catch (err) {
        console.error("Error fetching asset:", err);
        setError("Failed to load asset.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAsset();
  }, [assetId]);

  const updateField = (fieldPath: string, value: any) => {
    setAsset((prev) => (prev ? updateNestedField(prev, fieldPath, value) : prev));
  };

  const handleChange = (field: keyof Asset, value: any) => {
    setAsset((prev) =>
      prev ? { ...prev, [field]: value } : prev
    );
  };

  const saveAsset = async (): Promise<boolean> => {
    if (!asset) return false;
    setIsSaving(true);
    try {
      await updateAsset(asset._id, asset);
      showSuccess("Asset updated successfully!");
      return true;
    } catch (err) {
      console.error("Error saving asset:", err);
      showError("Failed to save asset.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    asset,
    isLoading,
    isSaving,
    error,
    handleChange,
    updateField,
    saveAsset,
    setAsset, // in case you want to directly update the object (e.g. for nested schedule fields)
  };
};