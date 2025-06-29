import { addTestEquipToWorkOrder } from "../../services/workOrderAPI";


export const useTestEquipment = (workOrderId: string, onRefresh: () => void) => {
    const addEquip = async (equipmentId: string) => {
        try {
            if (!equipmentId) return null;

            await addTestEquipToWorkOrder(workOrderId, equipmentId);
            onRefresh();
        } catch (err) {
            console.error("Failed to add Test Equip:", err);
        }
    }

    return { addEquip };
}