import { addPartToWorkOrder, deletePart, editPartOnWorkOrder } from "../../services/partAPI";


export const useWorkOrderParts = (workOrderId: string, onRefresh: () => void) => {
    const addPart = async ( part: { partId: string, quantity: number }) => {
        try {
            if (!workOrderId || !part.partId) return;

            await addPartToWorkOrder(workOrderId, part.partId, part.quantity);
            onRefresh();
        } catch (err) {
            console.error("Failed to add part:", err);
        }
    }

    const editPart = async ( partId: string, update: Partial<{ quantity: number }>) => {
        try {
            if (!workOrderId || !partId) return;

            await editPartOnWorkOrder(workOrderId, partId, update);
            onRefresh();
        } catch (err) {
            console.error("Failed to update part:", err);
        }
    }

    const removePart = async (partId: string) => {
        try {
            await deletePart(workOrderId, partId);
            onRefresh();
        } catch (err) {
            console.error("Failed to delete part", err);
        }
    }

    return { addPart, editPart, removePart };
}