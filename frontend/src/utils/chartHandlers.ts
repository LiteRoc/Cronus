// chartHandlers.ts

/**
 * Generic handler for Recharts chart click events.
 * Extracts a string label (e.g., status or name) from the event and passes it to a callback.
 *
 * @param event - The click event object from Recharts (BarChart, PieChart, etc.)
 * @param type - Either 'workOrders' or 'assets' to determine filtering context
 * @param onFilter - Callback to trigger filtering logic
 */
export const handleChartClick = (
  event: any,
  type: "workOrders" | "assets",
  onFilter: (type: "workOrders" | "assets", status: string) => void
): void => {
  const status = event?.activeLabel || event?.name;

  if (typeof status === "string") {
    onFilter(type, status);
  } else {
    console.warn("Chart click ignored: No valid label found in event.", event);
  }
};

/**
 * Handles clicks in Pie charts when each segment contains its name as `payload.name`.
 *
 * @param event - Pie chart click event
 * @param type - 'workOrders' or 'assets'
 * @param onFilter - Callback to trigger filtering logic
 */
export const handlePieChartClick = (
  event: any,
  type: "workOrders" | "assets",
  onFilter: (type: "workOrders" | "assets", status: string) => void
): void => {
  const status = event?.name || event?.payload?.name;
  if (typeof status === "string") {
    onFilter(type, status);
  } else {
    console.warn("Pie chart click ignored: no valid segment name found.");
  }
};