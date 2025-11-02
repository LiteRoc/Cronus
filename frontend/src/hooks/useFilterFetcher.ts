// Deprecated
// grep -R "useFilterFetcher" src/

import { useFilteredStore } from "./useFilteredStore";
import { fetchAssets } from "../services/assetAPI";
import { fetchWorkOrders } from "../services/workOrderAPI";
import { showError } from "../utils/toastUtils";
import { FilteredType } from "../types/types";

export const useFilteredFetcher = () => {
  const { applyFilter } = useFilteredStore();

  const fetchFilteredItems = async (type: FilteredType, queryParams: Record<string, string>) => {
  try {
    let result;

    //console.log('fetchFilteredItems Type:', type);

    if (type === "assets") {
      result = await fetchAssets(queryParams); // Expecting an object
      //console.log("Fetched Result:", JSON.stringify(result, null, 2));
    } else if (type === "workOrders") {
      result = await fetchWorkOrders(queryParams);
      //console.log('Quering Work Orders by:', queryParams);
      //console.log("Fetched Result:", JSON.stringify(result, null, 2));
    } else {
      throw new Error("Invalid filter type.");
    }

    const { assets = [], workOrders = [], totalPages, currentPage, totalAssets, totalWorkOrders } = result;

    const items = type === "assets" ? assets : workOrders;
    const totalCount = type === "assets" ? totalAssets : totalWorkOrders;

    applyFilter(type, items, { totalPages, currentPage, totalCount });

    //console.log("Filtered response:", result);

  } catch (error) {
    console.error("Failed to fetch filtered data:", error);
    showError("Failed to fetch filtered results.");
  }
};


  return { fetchFilteredItems };
};