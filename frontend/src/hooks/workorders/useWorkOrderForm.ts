import { useEffect, useState } from "react";
import { WorkOrder } from "../../types/types";
import { getWorkOrderById } from "../../services/workOrderAPI";
import { useWorkOrderActions } from "./useWorkOrderActions";

export const useWorkOrderForm = (workOrderId: string) => {
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { saveWorkOrder } = useWorkOrderActions();

  const fetchWorkOrder = async () => {
      if (!workOrderId) return;
      try {
        const data = await getWorkOrderById(workOrderId);
        setWorkOrder(data);
      } catch (err) {
        console.error("Error loading work order:", err);
        setError("Failed to load work order.");
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchWorkOrder();
  }, [workOrderId]);

  const handleChange = (field: keyof WorkOrder, value: any) => {
    setWorkOrder((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateNestedField = (fieldPath: string, value: any) => {
    setWorkOrder((prev) => {
      if (!prev) return prev;

      const keys = fieldPath.split(".");
      const updated = { ...prev };
      let current: any = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const save = async (): Promise<boolean> => {
    if (!workOrder) return false;
    setIsSaving(true);
    try {
      await saveWorkOrder(workOrder);
      return true;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    workOrder,
    isLoading,
    isSaving,
    error,
    handleChange,
    updateNestedField,
    save,
    setWorkOrder,
    fetchWorkOrder
  };
};