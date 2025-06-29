import { useState } from "react";
import { Asset, WorkOrder } from "../types/types";
import { isAssetArray, isWorkOrderArray } from "../utils/typeGuards";

type FilteredType = "workOrders" | "assets";

interface FilteredData {
  type: FilteredType;
  items: WorkOrder[] | Asset[];
}

export const useFilteredData = () => {
  const [filteredData, setFilteredData] = useState<FilteredData | null>(null);
  //console.log("useFilteredData hook invoked");

  const applyFilter = (type: FilteredType, items: WorkOrder[] | Asset[]) => {
    if (type === "workOrders" && isWorkOrderArray(items)) {
      setFilteredData({ type, items });
    } else if (type === "assets" && isAssetArray(items)) {
      setFilteredData({ type, items });
    } else {
      console.error("Invalid items passed to applyFilter.");
      setFilteredData(null);
    }
  };

  const removeItemFromFilteredData = (id: string) => {
    setFilteredData((prev) => {
      if (!prev) return null;

      const filteredItems = prev.items.filter((item) => item._id !== id);

      // Validate that we're returning correctly typed items
      if (prev.type === "workOrders" && isWorkOrderArray(filteredItems)) {
        return { type: "workOrders", items: filteredItems };
      } else if (prev.type === "assets" && isAssetArray(filteredItems)) {
        return { type: "assets", items: filteredItems };
      }

      return null;
    });
  };

  const updateItemInFilteredData = (updatedItem: WorkOrder | Asset) => {
    setFilteredData((prev) => {
      if (!prev) return null;

      const updatedItems = prev.items.map((item) =>
        item._id === updatedItem._id ? updatedItem : item
      );

      if (prev.type === "workOrders" && isWorkOrderArray(updatedItems)) {
        return { type: "workOrders", items: updatedItems };
      } else if (prev.type === "assets" && isAssetArray(updatedItems)) {
        return { type: "assets", items: updatedItems };
      }

      return null;
    });
  };

  return {
    filteredData,
    applyFilter,
    removeItemFromFilteredData,
    updateItemInFilteredData,
    setFilteredData, // optional: direct setter if needed
  };
};