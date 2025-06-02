import { createWorkOrder } from "../services/api";
import { WorkOrder } from "../types/types";

export const handleCreateWorkOrder = async (
    newWorkOrder: Partial<WorkOrder>,
    onSuccess: (createdWorkOrder: WorkOrder) => void,
    onError: (error: Error) => void
  ) => {
    console.log('handleCreateWorkOrder successfully called ...');
    try {
      const createdWorkOrder = await createWorkOrder(newWorkOrder);
      onSuccess(createdWorkOrder);
    } catch (error) {
      onError(error as Error);
    }
  };