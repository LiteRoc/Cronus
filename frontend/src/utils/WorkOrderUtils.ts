import { addWorkOrder } from "../services/workOrderAPI";
import { WorkOrder } from "../types/types";

export const handleCreateWorkOrder = async (
  newWorkOrder: WorkOrder,
  onSuccess: (workOrder: WorkOrder) => void,
  onError: (error: any) => void
): Promise<void> => {
  try {
    const created = await addWorkOrder(newWorkOrder);
    onSuccess(created);
  } catch (err) {
    onError(err);
  }
};