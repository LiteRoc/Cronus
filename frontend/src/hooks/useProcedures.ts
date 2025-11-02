// src/hooks/useProcedures.ts
import useSWR from "swr";
import { Procedure } from "@/types";
import {
  getProcedureById,
  getProcedures,
  createProcedure,
  updateProcedure,
  deleteProcedure,
} from "@/services/procedureAPI";
import { showSuccess, showError } from "@/utils/toastUtils";

// 🧩 Fetch ALL procedures
export const useProcedures = () => {
  const {
    data: procedures,
    error,
    isLoading,
    mutate,
  } = useSWR<Procedure[]>("procedures", getProcedures);

  // --- CRUD actions ---
  const addProcedure = async (payload: Partial<Procedure>) => {
    try {
      await createProcedure(payload);
      showSuccess("Procedure created successfully");
      mutate(); // revalidate list
    } catch (err) {
      console.error(err);
      showError("Failed to create procedure");
    }
  };

  const editProcedure = async (id: string, payload: Partial<Procedure>) => {
    try {
      await updateProcedure(id, payload);
      showSuccess("Procedure updated successfully");
      mutate();
    } catch (err) {
      console.error(err);
      showError("Failed to update procedure");
    }
  };

  const removeProcedure = async (id: string) => {
    try {
      await deleteProcedure(id);
      showSuccess("Procedure deleted successfully");
      mutate();
    } catch (err) {
      console.error(err);
      showError("Failed to delete procedure");
    }
  };

  return {
    procedures: procedures ?? [],
    isLoading,
    isError: !!error,
    mutate,
    addProcedure,
    editProcedure,
    removeProcedure,
  };
};

// 🧩 Fetch a single procedure by ID
export const useProcedureById = (procedureId?: string | null) => {
  const shouldFetch = !!procedureId;
  const {
    data: procedure,
    error,
    isLoading,
    mutate,
  } = useSWR<Procedure>(
    shouldFetch ? `procedure/${procedureId}` : null,
    () => getProcedureById(procedureId!)
  );

  return {
    procedure,
    isLoading,
    isError: !!error,
    mutate,
  };
};