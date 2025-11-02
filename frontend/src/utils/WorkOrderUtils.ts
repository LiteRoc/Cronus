//src/utils/WorkOrderUtils.ts
//AM I USING THIS???

import { addWorkOrder } from "../services/workOrderAPI";
import { WorkOrder, WorkOrderCreatePayload } from "@/types";

export const handleCreateWorkOrder = async (
  newWorkOrder: WorkOrderCreatePayload,
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