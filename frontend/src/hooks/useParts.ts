import useSWR from "swr";
import { Part } from "@/types";
import {
  getParts,
  getPartById,
  createPart,
  updatePart,
  deletePart,
} from "@/services/partAPI";
import { showSuccess, showError } from "@/utils/toastUtils";

/**
 * 🧾 Fetch all parts and provide CRUD helpers
 */
export const useParts = () => {
  const {
    data: parts,
    error,
    isLoading,
    mutate,
  } = useSWR<Part[]>("parts", getParts);

  // ➕ Create
  const addPart = async (payload: Partial<Part>) => {
    try {
      await createPart(payload);
      showSuccess("Part created successfully");
      mutate(); // revalidate SWR cache
    } catch (err) {
      console.error("Error creating part:", err);
      showError("Failed to create part");
    }
  };

  // ✏️ Update
  const editPart = async (id: string, payload: Partial<Part>) => {
    try {
      await updatePart(id, payload);
      showSuccess("Part updated successfully");
      mutate();
    } catch (err) {
      console.error("Error updating part:", err);
      showError("Failed to update part");
    }
  };

  // 🗑️ Delete
  const removePart = async (id: string) => {
    try {
      await deletePart(id);
      showSuccess("Part deleted successfully");
      mutate();
    } catch (err) {
      console.error("Error deleting part:", err);
      showError("Failed to delete part");
    }
  };

  return {
    parts: parts ?? [],
    isLoading,
    isError: !!error,
    mutate,
    addPart,
    editPart,
    removePart,
  };
};

/**
 * 🔍 Fetch a single part by ID
 */
export const usePartById = (partId?: string | null) => {
  const shouldFetch = !!partId;

  const {
    data: part,
    error,
    isLoading,
    mutate,
  } = useSWR<Part>(
    shouldFetch ? `part/${partId}` : null,
    () => getPartById(partId!)
  );

  return {
    part,
    isLoading,
    isError: !!error,
    mutate,
  };
};