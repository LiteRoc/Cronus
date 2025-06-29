import { TimeLog, TravelLog } from "../types/types";

export const calculateTimeTotals = (timeLogs: TimeLog[] = []) => {
  const totalMinutes = timeLogs.reduce((sum, log) => sum + (log.timeSpent || 0), 0);
  return {
    totalMinutes,
    entryCount: timeLogs.length,
  };
};

export const calculateTravelTotals = (travelLogs: TravelLog[] = []) => {
  const totalMinutes = travelLogs.reduce((sum, log) => sum + (log.travelTime || 0), 0);
  return {
    totalMinutes,
    entryCount: travelLogs.length,
  };
};