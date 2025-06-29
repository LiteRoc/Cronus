import { addTimeLog, addTravelLog, deleteTimeLog, updateTimeLog, updateTravelLog, deleteTravelLog } from "../../services/workOrderAPI";


export const useWorkOrderLogs = (workOrderId: string, userId: string, onRefresh: () => void) => {
    const addLog = async (timeLog: { timeSpent: number; description: string }, travelLog?: { travelTime: number }) => {
        try {
            if (!workOrderId || !userId) return;

            await addTimeLog(workOrderId, { ...timeLog, userId });

            if (travelLog) {
                await addTravelLog(workOrderId, { ...travelLog, userId });
            }

            onRefresh();
        } catch (err) {
            console.error("Failed to add logs:", err);
        }
    };

    const editTimeLog = async (timeLogId: string, updates: Partial<{ timeSpent: number; description: string }>) => {
        try {
            await updateTimeLog(workOrderId, timeLogId, updates);
            onRefresh();
        } catch (err) {
            console.error("Failed to update time log:", err);
        }
    };

    const editTravelLog = async (travelLogId: string, updates: Partial<{ travelTime: number }>) => {
        try {
            await updateTravelLog(workOrderId, travelLogId, updates);
            onRefresh();
        } catch (err) {
            console.error("Failed to update travel log:", err);
        }
    }

    const removeTimeLog = async (timeLogId: string) => {
        try {
            await deleteTimeLog(workOrderId, timeLogId);
            onRefresh();
        } catch (err) {
            console.error("Failed to delete time log:", err);
        }
    }

    const removeTravelLog = async (travelLogId: string) => {
        try {
            await deleteTravelLog(workOrderId, travelLogId);
            onRefresh();
        } catch (err) {
            console.error("Failed to delet travel log:", err);
        }
    }

    return { addLog, editTimeLog, editTravelLog, removeTimeLog, removeTravelLog };
}