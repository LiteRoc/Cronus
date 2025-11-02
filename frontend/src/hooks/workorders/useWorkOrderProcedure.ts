//src/hooks/workorders/useWorkOrderProcedure.ts

import useSWR from "swr";
import type { KeyedMutator } from "swr";
import { assignProcedureToWorkOrder, updateProcedureResults, removeProcedure } from "@/services";
import { getProcedures } from "@/services/procedureAPI";
import { Procedure, WorkOrder } from "@/types";
import { useState } from "react";
import { showSuccess } from "@/utils/toastUtils";

type Options = {
  /** Only fetch the procedures list when true (e.g., when a modal opens). Defaults to true. */
  enabledProcedures?: boolean;
  /** Pass SWR mutate from useWorkOrderForm to revalidate the work order after actions. */
  mutateWorkOrder?: KeyedMutator<WorkOrder>;
};

export function useWorkOrderProcedure(workOrderId: string, options: Options = {}) {
  const { enabledProcedures = true, mutateWorkOrder } = options;

  const [isAttaching, setIsAttaching] = useState(false);

  const {
    data: procedures,
    error: procedureError,
    isLoading: isProcedureLoading,
    mutate: mutateProcedures,
  } = useSWR<Procedure[]>(enabledProcedures ? "/procedures" : null, getProcedures, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  // Attach a procedure to a work order
  const attachProcedure = async (procedureId: string) => {
    if (!workOrderId) throw new Error("workOrderId is empty");
    try {
      setIsAttaching(true);
      const result = await assignProcedureToWorkOrder(workOrderId, procedureId);

      // revalidate the work order data in the UI
      if (mutateWorkOrder) await mutateWorkOrder();
      
      return result;
    } finally {
      setIsAttaching(false);
    }
  };

  // Update task results for a procedure in a work order
  const perfromTasks = async (procedureId: string, taskResults: any[]) => {
    if (!workOrderId) throw new Error("workOrderId is required");
    const result = await updateProcedureResults(
      workOrderId,
      procedureId,
      taskResults
    );
    if (mutateWorkOrder) await mutateWorkOrder(); // refresh WO
    return result;
  };

  // Remove a procedure from the work order ... need to add on backend
  const deleteProcedure = async (procedureId: string) => {
    if (!workOrderId) throw new Error("workOrderId is required");
    await removeProcedure(workOrderId, procedureId)
      .then(() => {
        showSuccess("Procedure Removed")
      });
    if (mutateWorkOrder) await mutateWorkOrder(); // refresh WO
  };

  return {
    procedures,
    isProcedureLoading,
    procedureError,
    mutateWorkOrder,
    mutateProcedures,
    attachProcedure,
    deleteProcedure,
    perfromTasks,
    isAttaching,
  };
};