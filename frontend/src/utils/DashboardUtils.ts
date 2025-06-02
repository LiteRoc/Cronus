import { Asset, WorkOrder, Part } from "../types/types";

/**
 * Filters items by type (work orders, assets, or parts).
 * @param items - The items to filter.
 * @param type - The type to filter by.
 * @returns Filtered items.
 */
export const filterByType = (
  items: (WorkOrder | Asset | Part)[],
  type: "workOrders" | "assets" | "parts"
): WorkOrder[] | Asset[] | Part[] => {
  switch (type) {
    case "workOrders":
      return items.filter((item): item is WorkOrder => "workOrderNumber" in item);
    case "assets":
      return items.filter((item): item is Asset => "controlNumber" in item);
    case "parts":
      return items.filter((item): item is Part => "partNumber" in item);
    default:
      return [];
  }
};

/**
 * Formats dates into a readable string.
 * @param date - The date to format.
 * @returns Formatted date string.
 */
export const formatDate = (date: string | Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  return new Date(date).toLocaleDateString(undefined, options);
};

export const formatDateForInput = (date: string | Date): string => {
  if (!date) return ""; // Return empty string for null or undefined
  const d = new Date(date);
  /*const localISODate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0]; // Extract YYYY-MM-DD
  return localISODate;*/
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatDateForDisplay = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};


/**
 * Capitalizes the first letter of a string.
 * @param str - The string to capitalize.
 * @returns Capitalized string.
 */
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Groups work orders by their status.
 * @param workOrders - The work orders to group.
 * @returns A map of statuses and their corresponding work orders.
 */
export const groupWorkOrdersByStatus = (
  workOrders: WorkOrder[]
): Record<string, WorkOrder[]> => {
  return workOrders.reduce((acc, workOrder) => {
    const status = workOrder.status || "Unknown";
    if (!acc[status]) acc[status] = [];
    acc[status].push(workOrder);
    return acc;
  }, {} as Record<string, WorkOrder[]>);
};

/**
 * Calculates the total time logged for a work order.
 * @param timeLogs - The time logs to calculate.
 * @returns Total time logged in minutes.
 */
export const calculateTotalTimeLogged = (
  timeLogs: WorkOrder["timeLogs"]
): number => {
  return timeLogs.reduce((total, log) => total + log.timeSpent, 0);
};

/**
 * Formats monetary values into a currency string.
 * @param value - The value to format.
 * @returns Formatted currency string.
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};