import { WorkOrder, Asset, Part } from "../types/types";

export function isWorkOrder(item: any): item is WorkOrder {
  return (
    typeof item === "object" &&
    "workOrderNumber" in item &&
    "assignedTo" in item &&
    "status" in item
  );
}

export function isAsset(item: any): item is Asset {
  return (
    typeof item === "object" &&
    "ctrlNumber" in item &&
    "manufacturer" in item &&
    "model" in item
  );
}

export function isPart(item: any): item is Part {
  return (
    typeof item === "object" &&
    "partNumber" in item &&
    "quantity" in item
  );
}

export const isWorkOrderArray = (items: any[]): items is WorkOrder[] => {
  return Array.isArray(items) &&
    items.length > 0 &&
    items.every(item => "_id" in item && "description" in item && "assetId" in item);
};

export const isAssetArray = (items: any[]): items is Asset[] => {
  //console.log('Validating Asset Array ...', items);

  if (!Array.isArray(items)) {
    console.error("Items are not an array.");
    return false;
  }
  // return Array.isArray(items) && items.every(isAsset);
    return items.every((item, index) => {
      const hasValidProperties = item && 
        typeof item.ctrlNumber === "string" &&
        typeof item.manufacturer === "string" &&
        typeof item.model === "string" &&
        typeof item.serialNumber === "string";
      
      if (!hasValidProperties) {
        console.error(`Validation failed at index ${index}:`, item);
      }
      
      return hasValidProperties;
    });
  };


  