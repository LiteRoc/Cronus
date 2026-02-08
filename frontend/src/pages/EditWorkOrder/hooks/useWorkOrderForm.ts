import { useState } from "react";
import useSWR from "swr";
import { WorkOrder } from "@/types";
import { fetchWorkOrder, updateWorkOrder } from "@/services";
import { updateNestedField } from "@/utils/updateNestedField";

export const useWorkOrderForm = (workOrderId: string) => {
  
  const { data: workOrder, error, isLoading, mutate } = useSWR(
    workOrderId ? ['workorder', workOrderId] : null,
    ([, id]) => fetchWorkOrder(id!)
  );

  const [isSaving, setIsSaving] = useState(false);

  const saveWorkOrder = async (updates: Partial<any>) => {
    try {
      setIsSaving(true);
      const updated = await updateWorkOrder(workOrderId, updates);
      mutate(updated, false); // update local cache without re-fetch
      return updated;
    } finally {
      setIsSaving(false);
    }
  };

  // use on flat fields ... status, priority, description
  const handleChange = (field: keyof WorkOrder, value: any) => { 
    if (!workOrder) return;
    mutate({ ...workOrder, [field]: value }, false);
  };

  // use for nested structures ... procedure.taskResults[0].value or partsUsed[2].quantity
  const updateField = (fieldPath: string, value: any) => { 
    if (!workOrder) return;
    const updated = updateNestedField(workOrder, fieldPath, value);
    mutate(updated, false);
  };

  return {
    workOrder,
    isLoading,
    isError: !!error,
    isSaving,
    handleChange, // flat fields
    updateField, // nested fields
    saveWorkOrder,
    mutate
  };
}
