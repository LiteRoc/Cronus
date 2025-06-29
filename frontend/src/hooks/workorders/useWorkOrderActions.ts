import { updateWorkOrder, addWorkOrder, removeWorkOrder } from "../../services/workOrderAPI";
import { WorkOrder } from "../../types/types";
import { showSuccess, showError } from "../../utils/toastUtils";
import { useFilteredData } from "../useFilteredData";

export const useWorkOrderActions = () => {
  const { updateItemInFilteredData, removeItemFromFilteredData, filteredData, applyFilter } = useFilteredData();

  const saveWorkOrder = async (workOrder: WorkOrder): Promise<void> => {
    try {
      const savedWorkOrder = await updateWorkOrder(workOrder._id, workOrder);
      updateItemInFilteredData(savedWorkOrder);
      showSuccess("Work order saved successfully!");
    } catch (error) {
      console.error("Failed to save work order:", error);
      showError("Failed to save changes. Please try again.");
    }
  };

  const createWorkOrder = async (newWorkOrder: WorkOrder): Promise<void> => {
    try {
      const response = await addWorkOrder(newWorkOrder);

      const created = response;

      if (filteredData?.type === "workOrders") {
        applyFilter("workOrders", [...filteredData.items, created]);
      }

      showSuccess("Work order created successfully!");
    } catch (error) {
      console.error("Error creating work order:", error);
      showError("Failed to create work order.");
    }
  };

  const deleteWorkOrder = async (id: string): Promise<void> => {
    try {
      await removeWorkOrder(id);
      removeItemFromFilteredData(id);
      showSuccess("Work order deleted.");
    } catch (error) {
      console.error("Failed to delete work order:", error);
      showError("Failed to delete work order.");
    }
  };

  return {
    saveWorkOrder,
    createWorkOrder,
    deleteWorkOrder
  };
};